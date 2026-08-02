"use strict";
(() => {
  const originalFetch=window.fetch.bind(window);
  window.fetch=async(input,init={})=>{
    const response=await originalFetch(input,init);
    try{
      const url=typeof input==="string"?input:input?.url||"";
      const method=String(init?.method||"GET").toUpperCase();
      if(method==="POST"&&/\/admin\/notificacoes(?:\?|$)/.test(url)&&response.ok){
        const data=await response.clone().json().catch(()=>({}));
        const id=data?.notificacao?.id||data?.notificacao?._id;
        if(id){
          const headers={Accept:"application/json"};
          const sourceHeaders=init?.headers||{};
          if(sourceHeaders instanceof Headers){const auth=sourceHeaders.get("Authorization");if(auth)headers.Authorization=auth;}
          else if(sourceHeaders.Authorization)headers.Authorization=sourceHeaders.Authorization;
          originalFetch(`/push/enviar/${encodeURIComponent(id)}`,{method:"POST",headers}).catch(()=>{});
        }
      }
    }catch(_){}
    return response;
  };
})();