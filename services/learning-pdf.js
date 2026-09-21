"use strict";
const path=require('node:path'),B=require('./pdf-brand'),C=require('../public/study-curriculum'),{guides}=require('../public/study-guides');
const examples={gemeos:[11],espelhos:[12],fibonacci:[15,14,25,4],magneto:[24,1],camaleoes:[16,18,25],pitagoras:[0],cavalo:[14,27,31],eclipse:[0]};
function create(content){const m=C.modules.find(m=>m.id===content.id),g=guides[content.id];if(!m)throw Error('Módulo inválido');const d=B.create(m.name+' — Turma do Primo');
 function heading(t){if(d.y>690)d.addPage();d.font('PrimoBold').fontSize(13).fillColor('#65427e').text(t,52,d.y,{width:491}).moveDown(.5)}
 function para(t){d.font('Primo').fontSize(10.5).fillColor('#3e3447').text(String(t).replace(/[→↔]/g,' / '),52,d.y,{width:491,lineGap:4}).moveDown(.65)}
 d.save().roundedRect(52,87,491,214,18).fill('#251831').restore();d.image(path.join(__dirname,'pdf-assets',m.id+'.jpg'),290,99,{fit:[240,190],align:'center',valign:'center'});d.font('PrimoBold').fontSize(9).fillColor('#d2b976').text('CADERNOS DE ESTUDO',72,118,{width:208});d.fontSize(30).fillColor('#ffffff').text(m.name,72,153,{width:220});d.font('Primo').fontSize(10).fillColor('#d4c4e1').text(content.summary?'Resumo da videoaula':'Guia de estudo',72,253,{width:210});d.y=328;
 heading('01  /  Entenda o conceito');para(g.goal);para(m.intro);for(const [title,copy]of m.rules){heading(title);para(copy)}
 if(content.summary){heading('Resumo da videoaula');String(content.summary).split(/\n\s*\n/).filter(Boolean).forEach(para)}
 d.addPage();heading('02  /  Veja a leitura acontecer');para('Exemplo ilustrado com a ordem real da roda europeia. Roxo: origem; dourado: alvos; contorno: região de leitura.');
 const r=C.reading(m.id,examples[m.id],2),known=r.known||examples[m.id],targets=r.targets||[],coverage=r.coverage||[];const top=d.y;
 // Every cell is an exact wheel number. An ordered strip remains legible on A4.
 d.save().roundedRect(52,top,491,185,12).fill('#f0eaf4').restore();
 C.wheel.forEach((n,i)=>{const row=Math.floor(i/13),col=i%13,x=66+col*36,y=top+18+row*44,origin=known.includes(n),target=targets.includes(n);d.save().roundedRect(x,y,30,32,5).fillAndStroke(origin?'#bfa0dd':target?'#e8ca8c':'#fcfaf6',coverage.includes(n)?'#9c7aae':'#dfd5e4').restore();d.font('PrimoBold').fontSize(10).fillColor('#33223e').text(String(n),x,y+10,{width:30,align:'center',lineBreak:false})});d.font('Primo').fontSize(8).fillColor('#796384').text('Leia da esquerda para a direita. Após 26, a sequência volta ao 0.',66,top+158,{width:460});d.y=top+207;
 g.steps.forEach(([title,copy],i)=>{heading(`${i+1}. ${title}`);para(copy)});heading('Atenção a este detalhe');para(g.mistake);
 d.addPage();heading('03  /  Teste seu entendimento');para(g.check.question);g.check.options.forEach((o,i)=>para(`${String.fromCharCode(65+i)}. ${o}`));heading('Seu raciocínio');const y=d.y;d.save().strokeColor('#d9cfdf').lineWidth(.5);for(let i=0;i<6;i++)d.moveTo(52,y+i*25).lineTo(543,y+i*25).stroke();d.restore();d.y=y+167;heading('Correção comentada');para(`${String.fromCharCode(65+g.check.answer)}. ${g.check.options[g.check.answer]}. ${g.check.why}`);heading('Leve o aprendizado para a prática');para(m.remember);para(`Na plataforma, abra Estudo > ${m.name}, altere os valores do exemplo interativo e pratique o minigame.`);B.footer(d,m.name.toUpperCase()+' · MATERIAL DE APOIO','Turma do Primo · Exercícios educacionais');return d;
}
module.exports={create};
