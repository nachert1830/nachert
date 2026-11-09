/* Повторение задач сайта (nch2_rep: {задача:{b,d:день повтора,s,l,n,r}}): очередь на день. */
(function(){ 'use strict';
function queue(rep,today){ rep=rep&&typeof rep==='object'?rep:{}; return Object.keys(rep).filter(k=>rep[k]&&typeof rep[k]==='object').map(k=>({k,d:+rep[k].d||0,due:(+rep[k].d||0)<=today})).sort((a,b)=>a.d-b.d); }
const M={queue}; if(typeof module!=='undefined'&&module.exports) module.exports=M; else self.LKSRS=M;
})();
