"""Apply the verified public enrollment opening patch, refusing source drift."""
from pathlib import Path
import gzip,hashlib,struct,sys
source,patch,dest=map(Path,sys.argv[1:])
old=source.read_bytes();data=gzip.decompress(patch.read_bytes())
assert data[:8]==b'ACAENR1\x00'
assert hashlib.sha256(old).digest()==data[8:40], 'Original media hash changed'
expected=data[40:72];size=struct.unpack_from('>Q',data,72)[0]
out=bytearray();i=80
while i<len(data):
 op=data[i];i+=1
 if op==0:
  offset,n=struct.unpack_from('>QI',data,i);i+=12
  assert offset+n<=len(old);out+=old[offset:offset+n]
 elif op==1:
  n=struct.unpack_from('>I',data,i)[0];i+=4
  assert i+n<=len(data);out+=data[i:i+n];i+=n
 else:raise ValueError('Unknown patch operation')
assert len(out)==size
assert hashlib.sha256(out).digest()==expected, 'Reconstructed media hash mismatch'
dest.write_bytes(out)
print('Verified',len(out),'bytes; SHA-256',hashlib.sha256(out).hexdigest())
