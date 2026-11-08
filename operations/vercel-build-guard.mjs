// Vercel: exit 0 skips a build; exit 1 allows it. Unknown projects build normally.
// The checkout project remains the Academy backend. Preserve the old project's
// existing deployments while stopping duplicate builds of every repository push.
export function skipDuplicateBuild(env = process.env) {
  return env.VERCEL_PROJECT_ID === 'prj_5yh03dxBKjVnAwihiKKoN8WSdmEW'
}
if (process.argv[1]?.endsWith('/vercel-build-guard.mjs')) {
  const skip = skipDuplicateBuild()
  console.log(skip ? 'Skip duplicate Academy project build' : 'Continue Academy project build')
  process.exitCode = skip ? 0 : 1
}
