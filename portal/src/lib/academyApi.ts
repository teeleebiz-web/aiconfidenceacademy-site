export const academyBackendOrigin=()=>import.meta.env.VITE_ACA_BACKEND_ORIGIN??(window.location.hostname.endsWith('.vercel.app')?window.location.origin:'https://checkout.aiconfidenceacademy.org')
