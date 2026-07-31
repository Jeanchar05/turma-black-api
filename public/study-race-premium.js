"use strict";
(()=>{
  const TOP=[5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3];
  const BOTTOM=[8,30,11,36,13,27,6,34,17,25,2,21,4,19,15,32];
  const RED=new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
  function tone(n){return n===0?"green":RED.has(n)?"red":"black"}
  function button(n){const b=document.createElement("button");b.type="button";b.className=`race-num ${tone(n)}`;b.dataset.n=String(n);b.dataset.num=String(n);b.innerHTML=`<span>${n}</span>`;return b}
  function mount(root){if(typeof root==="string")root=document.querySelector(root);if(!root)return null;root.classList.add("premium-race");root.innerHTML="";
    const shell=document.createElement("div");shell.className="premium-race-shell";
    const top=document.createElement("div");top.className="premium-race-row premium-race-top";TOP.forEach(n=>top.appendChild(button(n)));
    const middle=document.createElement("div");middle.className="premium-race-middle";
    const left=document.createElement("div");left.className="premium-race-side premium-race-left";left.append(button(10),button(23));
    const center=document.createElement("div");center.className="premium-race-center";center.innerHTML='<span class="pr-sector tiers">Tiers</span><span class="pr-sector orphelins">Orphelins</span><span class="pr-sector voisins">Voisins</span><span class="pr-sector zero">Zero</span>';
    const right=document.createElement("div");right.className="premium-race-side premium-race-right";right.append(button(26),button(0));
    middle.append(left,center,right);
    const bottom=document.createElement("div");bottom.className="premium-race-row premium-race-bottom";BOTTOM.forEach(n=>bottom.appendChild(button(n)));
    shell.append(top,middle,bottom);root.appendChild(shell);return root
  }
  window.StudyRacePremium={mount,TOP,BOTTOM,RED};
})();