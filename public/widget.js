(function(){var ie=Object.defineProperty,se=(e,t)=>()=>(e&&(t=e(e=0)),t),ze=(e,t)=>{let n={};for(var o in e)ie(n,o,{get:e[o],enumerable:!0});return t||ie(n,Symbol.toStringTag,{value:"Module"}),n},H,v,_e,Le,P,le,ce,de,J,B,D,pe,K,V,Q,Oe,R={},I=[],Fe=/acit|ex(?:s|g|n|p|$)|rph|grid|ows|mnc|ntw|ine[ch]|zoo|^ord|itera/i,j=Array.isArray;function T(e,t){for(var n in t)e[n]=t[n];return e}function Y(e){e&&e.parentNode&&e.parentNode.removeChild(e)}function ue(e,t,n){var o,i,r,l={};for(r in t)r=="key"?o=t[r]:r=="ref"?i=t[r]:l[r]=t[r];if(arguments.length>2&&(l.children=arguments.length>3?H.call(arguments,2):n),typeof e=="function"&&e.defaultProps!=null)for(r in e.defaultProps)l[r]===void 0&&(l[r]=e.defaultProps[r]);return z(e,l,o,i,null)}function z(e,t,n,o,i){var r={type:e,props:t,key:n,ref:o,__k:null,__:null,__b:0,__e:null,__c:null,constructor:void 0,__v:i??++_e,__i:-1,__u:0};return i==null&&v.vnode!=null&&v.vnode(r),r}function N(e){return e.children}function L(e,t){this.props=e,this.context=t}function U(e,t){if(t==null)return e.__?U(e.__,e.__i+1):null;for(var n;t<e.__k.length;t++)if((n=e.__k[t])!=null&&n.__e!=null)return n.__e;return typeof e.type=="function"?U(e):null}function We(e){if(e.__P&&e.__d){var t=e.__v,n=t.__e,o=[],i=[],r=T({},t);r.__v=t.__v+1,v.vnode&&v.vnode(r),X(e.__P,r,t,e.__n,e.__P.namespaceURI,32&t.__u?[n]:null,o,n??U(t),!!(32&t.__u),i),r.__v=t.__v,r.__.__k[r.__i]=r,ye(o,r,i),t.__e=t.__=null,r.__e!=n&&fe(r)}}function fe(e){if((e=e.__)!=null&&e.__c!=null)return e.__e=e.__c.base=null,e.__k.some(function(t){if(t!=null&&t.__e!=null)return e.__e=e.__c.base=t.__e}),fe(e)}function he(e){(!e.__d&&(e.__d=!0)&&P.push(e)&&!O.__r++||le!=v.debounceRendering)&&((le=v.debounceRendering)||ce)(O)}function O(){try{for(var e,t=1;P.length;)P.length>t&&P.sort(de),e=P.shift(),t=P.length,We(e)}finally{P.length=O.__r=0}}function me(e,t,n,o,i,r,l,_,c,s,u){var a,f,d,b,w,x,h,m=o&&o.__k||I,S=t.length;for(c=Ge(n,t,m,c,S),a=0;a<S;a++)(d=n.__k[a])!=null&&(f=d.__i!=-1&&m[d.__i]||R,d.__i=a,x=X(e,d,f,i,r,l,_,c,s,u),b=d.__e,d.ref&&f.ref!=d.ref&&(f.ref&&ee(f.ref,null,d),u.push(d.ref,d.__c||b,d)),w==null&&b!=null&&(w=b),(h=!!(4&d.__u))||f.__k===d.__k?(c=ve(d,c,e,h),h&&f.__e&&(f.__e=null)):typeof d.type=="function"&&x!==void 0?c=x:b&&(c=b.nextSibling),d.__u&=-7);return n.__e=w,c}function Ge(e,t,n,o,i){var r,l,_,c,s,u=n.length,a=u,f=0;for(e.__k=new Array(i),r=0;r<i;r++)(l=t[r])!=null&&typeof l!="boolean"&&typeof l!="function"?(typeof l=="string"||typeof l=="number"||typeof l=="bigint"||l.constructor==String?l=e.__k[r]=z(null,l,null,null,null):j(l)?l=e.__k[r]=z(N,{children:l},null,null,null):l.constructor===void 0&&l.__b>0?l=e.__k[r]=z(l.type,l.props,l.key,l.ref?l.ref:null,l.__v):e.__k[r]=l,c=r+f,l.__=e,l.__b=e.__b+1,_=null,(s=l.__i=qe(l,n,c,a))!=-1&&(a--,(_=n[s])&&(_.__u|=2)),_==null||_.__v==null?(s==-1&&(i>u?f--:i<u&&f++),typeof l.type!="function"&&(l.__u|=4)):s!=c&&(s==c-1?f--:s==c+1?f++:(s>c?f--:f++,l.__u|=4))):e.__k[r]=null;if(a)for(r=0;r<u;r++)(_=n[r])!=null&&(2&_.__u)==0&&(_.__e==o&&(o=U(_)),ke(_,_));return o}function ve(e,t,n,o){var i,r;if(typeof e.type=="function"){for(i=e.__k,r=0;i&&r<i.length;r++)i[r]&&(i[r].__=e,t=ve(i[r],t,n,o));return t}e.__e!=t&&(o&&(t&&e.type&&!t.parentNode&&(t=U(e)),n.insertBefore(e.__e,t||null)),t=e.__e);do t=t&&t.nextSibling;while(t!=null&&t.nodeType==8);return t}function qe(e,t,n,o){var i,r,l,_=e.key,c=e.type,s=t[n],u=s!=null&&(2&s.__u)==0;if(s===null&&_==null||u&&_==s.key&&c==s.type)return n;if(o>(u?1:0)){for(i=n-1,r=n+1;i>=0||r<t.length;)if((s=t[l=i>=0?i--:r++])!=null&&(2&s.__u)==0&&_==s.key&&c==s.type)return l}return-1}function ge(e,t,n){t[0]=="-"?e.setProperty(t,n??""):e[t]=n==null?"":typeof n!="number"||Fe.test(t)?n:n+"px"}function F(e,t,n,o,i){var r,l;e:if(t=="style")if(typeof n=="string")e.style.cssText=n;else{if(typeof o=="string"&&(e.style.cssText=o=""),o)for(t in o)n&&t in n||ge(e.style,t,"");if(n)for(t in n)o&&n[t]==o[t]||ge(e.style,t,n[t])}else if(t[0]=="o"&&t[1]=="n")r=t!=(t=t.replace(pe,"$1")),l=t.toLowerCase(),t=l in e||t=="onFocusOut"||t=="onFocusIn"?l.slice(2):t.slice(2),e.l||(e.l={}),e.l[t+r]=n,n?o?n[D]=o[D]:(n[D]=K,e.addEventListener(t,r?Q:V,r)):e.removeEventListener(t,r?Q:V,r);else{if(i=="http://www.w3.org/2000/svg")t=t.replace(/xlink(H|:h)/,"h").replace(/sName$/,"s");else if(t!="width"&&t!="height"&&t!="href"&&t!="list"&&t!="form"&&t!="tabIndex"&&t!="download"&&t!="rowSpan"&&t!="colSpan"&&t!="role"&&t!="popover"&&t in e)try{e[t]=n??"";break e}catch{}typeof n=="function"||(n==null||n===!1&&t[4]!="-"?e.removeAttribute(t):e.setAttribute(t,t=="popover"&&n==1?"":n))}}function be(e){return function(t){if(this.l){var n=this.l[t.type+e];if(t[B]==null)t[B]=K++;else if(t[B]<n[D])return;return n(v.event?v.event(t):t)}}}function X(e,t,n,o,i,r,l,_,c,s){var u,a,f,d,b,w,x,h,m,S,g,C,q,M,ae,$=t.type;if(t.constructor!==void 0)return null;128&n.__u&&(c=!!(32&n.__u),r=[_=t.__e=n.__e]),(u=v.__b)&&u(t);e:if(typeof $=="function")try{if(h=t.props,m=$.prototype&&$.prototype.render,S=(u=$.contextType)&&o[u.__c],g=u?S?S.props.value:u.__:o,n.__c?x=(a=t.__c=n.__c).__=a.__E:(m?t.__c=a=new $(h,g):(t.__c=a=new L(h,g),a.constructor=$,a.render=Ke),S&&S.sub(a),a.state||(a.state={}),a.__n=o,f=a.__d=!0,a.__h=[],a._sb=[]),m&&a.__s==null&&(a.__s=a.state),m&&$.getDerivedStateFromProps!=null&&(a.__s==a.state&&(a.__s=T({},a.__s)),T(a.__s,$.getDerivedStateFromProps(h,a.__s))),d=a.props,b=a.state,a.__v=t,f)m&&$.getDerivedStateFromProps==null&&a.componentWillMount!=null&&a.componentWillMount(),m&&a.componentDidMount!=null&&a.__h.push(a.componentDidMount);else{if(m&&$.getDerivedStateFromProps==null&&h!==d&&a.componentWillReceiveProps!=null&&a.componentWillReceiveProps(h,g),t.__v==n.__v||!a.__e&&a.shouldComponentUpdate!=null&&a.shouldComponentUpdate(h,a.__s,g)===!1){t.__v!=n.__v&&(a.props=h,a.state=a.__s,a.__d=!1),t.__e=n.__e,t.__k=n.__k,t.__k.some(function(A){A&&(A.__=t)}),I.push.apply(a.__h,a._sb),a._sb=[],a.__h.length&&l.push(a);break e}a.componentWillUpdate!=null&&a.componentWillUpdate(h,a.__s,g),m&&a.componentDidUpdate!=null&&a.__h.push(function(){a.componentDidUpdate(d,b,w)})}if(a.context=g,a.props=h,a.__P=e,a.__e=!1,C=v.__r,q=0,m)a.state=a.__s,a.__d=!1,C&&C(t),u=a.render(a.props,a.state,a.context),I.push.apply(a.__h,a._sb),a._sb=[];else do a.__d=!1,C&&C(t),u=a.render(a.props,a.state,a.context),a.state=a.__s;while(a.__d&&++q<25);a.state=a.__s,a.getChildContext!=null&&(o=T(T({},o),a.getChildContext())),m&&!f&&a.getSnapshotBeforeUpdate!=null&&(w=a.getSnapshotBeforeUpdate(d,b)),M=u!=null&&u.type===N&&u.key==null?xe(u.props.children):u,_=me(e,j(M)?M:[M],t,n,o,i,r,l,_,c,s),a.base=t.__e,t.__u&=-161,a.__h.length&&l.push(a),x&&(a.__E=a.__=null)}catch(A){if(t.__v=null,c||r!=null)if(A.then){for(t.__u|=c?160:128;_&&_.nodeType==8&&_.nextSibling;)_=_.nextSibling;r[r.indexOf(_)]=null,t.__e=_}else{for(ae=r.length;ae--;)Y(r[ae]);Z(t)}else t.__e=n.__e,t.__k=n.__k,A.then||Z(t);v.__e(A,t,n)}else r==null&&t.__v==n.__v?(t.__k=n.__k,t.__e=n.__e):_=t.__e=Je(n.__e,t,n,o,i,r,l,c,s);return(u=v.diffed)&&u(t),128&t.__u?void 0:_}function Z(e){e&&(e.__c&&(e.__c.__e=!0),e.__k&&e.__k.some(Z))}function ye(e,t,n){for(var o=0;o<n.length;o++)ee(n[o],n[++o],n[++o]);v.__c&&v.__c(t,e),e.some(function(i){try{e=i.__h,i.__h=[],e.some(function(r){r.call(i)})}catch(r){v.__e(r,i.__v)}})}function xe(e){return typeof e!="object"||e==null||e.__b>0?e:j(e)?e.map(xe):T({},e)}function Je(e,t,n,o,i,r,l,_,c){var s,u,a,f,d,b,w,x=n.props||R,h=t.props,m=t.type;if(m=="svg"?i="http://www.w3.org/2000/svg":m=="math"?i="http://www.w3.org/1998/Math/MathML":i||(i="http://www.w3.org/1999/xhtml"),r!=null){for(s=0;s<r.length;s++)if((d=r[s])&&"setAttribute"in d==!!m&&(m?d.localName==m:d.nodeType==3)){e=d,r[s]=null;break}}if(e==null){if(m==null)return document.createTextNode(h);e=document.createElementNS(i,m,h.is&&h),_&&(v.__m&&v.__m(t,r),_=!1),r=null}if(m==null)x===h||_&&e.data==h||(e.data=h);else{if(r=r&&H.call(e.childNodes),!_&&r!=null)for(x={},s=0;s<e.attributes.length;s++)x[(d=e.attributes[s]).name]=d.value;for(s in x)d=x[s],s=="dangerouslySetInnerHTML"?a=d:s=="children"||s in h||s=="value"&&"defaultValue"in h||s=="checked"&&"defaultChecked"in h||F(e,s,null,d,i);for(s in h)d=h[s],s=="children"?f=d:s=="dangerouslySetInnerHTML"?u=d:s=="value"?b=d:s=="checked"?w=d:_&&typeof d!="function"||x[s]===d||F(e,s,d,x[s],i);if(u)_||a&&(u.__html==a.__html||u.__html==e.innerHTML)||(e.innerHTML=u.__html),t.__k=[];else if(a&&(e.innerHTML=""),me(t.type=="template"?e.content:e,j(f)?f:[f],t,n,o,m=="foreignObject"?"http://www.w3.org/1999/xhtml":i,r,l,r?r[0]:n.__k&&U(n,0),_,c),r!=null)for(s=r.length;s--;)Y(r[s]);_||(s="value",m=="progress"&&b==null?e.removeAttribute("value"):b!=null&&(b!==e[s]||m=="progress"&&!b||m=="option"&&b!=x[s])&&F(e,s,b,x[s],i),s="checked",w!=null&&w!=e[s]&&F(e,s,w,x[s],i))}return e}function ee(e,t,n){try{if(typeof e=="function"){var o=typeof e.__u=="function";o&&e.__u(),o&&t==null||(e.__u=e(t))}else e.current=t}catch(i){v.__e(i,n)}}function ke(e,t,n){var o,i;if(v.unmount&&v.unmount(e),(o=e.ref)&&(o.current&&o.current!=e.__e||ee(o,null,t)),(o=e.__c)!=null){if(o.componentWillUnmount)try{o.componentWillUnmount()}catch(r){v.__e(r,t)}o.base=o.__P=null}if(o=e.__k)for(i=0;i<o.length;i++)o[i]&&ke(o[i],t,n||typeof e.type!="function");n||Y(e.__e),e.__c=e.__=e.__e=void 0}function Ke(e,t,n){return this.constructor(e,n)}function Ve(e,t,n){var o,i,r,l;t==document&&(t=document.documentElement),v.__&&v.__(e,t),i=(o=typeof n=="function")?null:n&&n.__k||t.__k,r=[],l=[],X(t,e=(!o&&n||t).__k=ue(N,null,[e]),i||R,R,t.namespaceURI,!o&&n?[n]:i?null:t.firstChild?H.call(t.childNodes):null,r,!o&&n?n:i?i.__e:t.firstChild,o,l),ye(r,e,l)}H=I.slice,v={__e:function(e,t,n,o){for(var i,r,l;t=t.__;)if((i=t.__c)&&!i.__)try{if((r=i.constructor)&&r.getDerivedStateFromError!=null&&(i.setState(r.getDerivedStateFromError(e)),l=i.__d),i.componentDidCatch!=null&&(i.componentDidCatch(e,o||{}),l=i.__d),l)return i.__E=i}catch(_){e=_}throw e}},_e=0,Le=function(e){return e!=null&&e.constructor===void 0},L.prototype.setState=function(e,t){var n=this.__s!=null&&this.__s!=this.state?this.__s:this.__s=T({},this.state);typeof e=="function"&&(e=e(T({},n),this.props)),e&&T(n,e),e!=null&&this.__v&&(t&&this._sb.push(t),he(this))},L.prototype.forceUpdate=function(e){this.__v&&(this.__e=!0,e&&this.__h.push(e),he(this))},L.prototype.render=N,P=[],ce=typeof Promise=="function"?Promise.prototype.then.bind(Promise.resolve()):setTimeout,de=function(e,t){return e.__v.__b-t.__v.__b},O.__r=0,J=Math.random().toString(8),B="__d"+J,D="__a"+J,pe=/(PointerCapture)$|Capture$/i,K=0,V=be(!1),Q=be(!0),Oe=0;var W,y,te,we,ne=0,Se=[],k=v,Ce=k.__b,$e=k.__r,Te=k.diffed,Pe=k.__c,Ee=k.unmount,Ne=k.__;function Ue(e,t){k.__h&&k.__h(y,e,ne||t),ne=0;var n=y.__H||(y.__H={__:[],__h:[]});return e>=n.__.length&&n.__.push({}),n.__[e]}function E(e){return ne=1,Qe(Ae,e)}function Qe(e,t,n){var o=Ue(W++,2);if(o.t=e,!o.__c&&(o.__=[n?n(t):Ae(void 0,t),function(_){var c=o.__N?o.__N[0]:o.__[0],s=o.t(c,_);c!==s&&(o.__N=[s,o.__[1]],o.__c.setState({}))}],o.__c=y,!y.__f)){var i=function(_,c,s){if(!o.__c.__H)return!0;var u=o.__c.__H.__.filter(function(f){return f.__c});if(u.every(function(f){return!f.__N}))return!r||r.call(this,_,c,s);var a=o.__c.props!==_;return u.some(function(f){if(f.__N){var d=f.__[0];f.__=f.__N,f.__N=void 0,d!==f.__[0]&&(a=!0)}}),r&&r.call(this,_,c,s)||a};y.__f=!0;var r=y.shouldComponentUpdate,l=y.componentWillUpdate;y.componentWillUpdate=function(_,c,s){if(this.__e){var u=r;r=void 0,i(_,c,s),r=u}l&&l.call(this,_,c,s)},y.shouldComponentUpdate=i}return o.__N||o.__}function Ye(e,t){var n=Ue(W++,3);!k.__s&&et(n.__H,t)&&(n.__=e,n.u=t,y.__H.__h.push(n))}function Xe(){for(var e;e=Se.shift();){var t=e.__H;if(e.__P&&t)try{t.__h.some(G),t.__h.some(re),t.__h=[]}catch(n){t.__h=[],k.__e(n,e.__v)}}}k.__b=function(e){y=null,Ce&&Ce(e)},k.__=function(e,t){e&&t.__k&&t.__k.__m&&(e.__m=t.__k.__m),Ne&&Ne(e,t)},k.__r=function(e){$e&&$e(e),W=0;var t=(y=e.__c).__H;t&&(te===y?(t.__h=[],y.__h=[],t.__.some(function(n){n.__N&&(n.__=n.__N),n.u=n.__N=void 0})):(t.__h.some(G),t.__h.some(re),t.__h=[],W=0)),te=y},k.diffed=function(e){Te&&Te(e);var t=e.__c;t&&t.__H&&(t.__H.__h.length&&(Se.push(t)!==1&&we===k.requestAnimationFrame||((we=k.requestAnimationFrame)||Ze)(Xe)),t.__H.__.some(function(n){n.u&&(n.__H=n.u),n.u=void 0})),te=y=null},k.__c=function(e,t){t.some(function(n){try{n.__h.some(G),n.__h=n.__h.filter(function(o){return!o.__||re(o)})}catch(o){t.some(function(i){i.__h&&(i.__h=[])}),t=[],k.__e(o,n.__v)}}),Pe&&Pe(e,t)},k.unmount=function(e){Ee&&Ee(e);var t,n=e.__c;n&&n.__H&&(n.__H.__.some(function(o){try{G(o)}catch(i){t=i}}),n.__H=void 0,t&&k.__e(t,n.__v))};var Me=typeof requestAnimationFrame=="function";function Ze(e){var t,n=function(){clearTimeout(o),Me&&cancelAnimationFrame(t),setTimeout(e)},o=setTimeout(n,35);Me&&(t=requestAnimationFrame(n))}function G(e){var t=y,n=e.__c;typeof n=="function"&&(e.__c=void 0,n()),y=t}function re(e){var t=y;e.__c=e.__(),y=t}function et(e,t){return!e||e.length!==t.length||t.some(function(n,o){return n!==e[o]})}function Ae(e,t){return typeof t=="function"?t(e):t}var De=typeof window<"u"&&window.__FEEDBACKBOT_ORIGIN__||"";async function tt(e){const t={message:e.message,page_url:e.pageUrl,user_agent:e.userAgent,email:e.email??"",honeypot:"",want_screenshot_upload:!!e.screenshotDataUrl};try{const n=await fetch(`${De}/api/ticket`,{method:"POST",credentials:"include",headers:{"content-type":"application/json"},body:JSON.stringify(t)});if(!n.ok)return{ok:!1,status:n.status,message:`HTTP ${n.status}`};const o=await n.json();return e.screenshotDataUrl&&o.screenshot_upload_url&&await nt(o.screenshot_upload_url,e.screenshotDataUrl),{ok:!0,ticketId:o.ticket_id,routedTo:null}}catch(n){return{ok:!1,status:0,message:n instanceof Error?n.message:"network"}}}async function nt(e,t){const n=await(await fetch(t)).blob();await fetch(e,{method:"PUT",headers:{"content-type":"image/png"},body:n}).catch(()=>{})}async function rt(){try{const e=await fetch(`${De}/api/widget-config`,{credentials:"include"});return e.ok?await e.json():{plan:null,remove_branding:!1}}catch{return{plan:null,remove_branding:!1}}}var ht=/acit|ex(?:s|g|n|p|$)|rph|grid|ows|mnc|ntw|ine[ch]|zoo|^ord|itera/i,ot=0,mt=Array.isArray;function p(e,t,n,o,i,r){t||(t={});var l,_,c=t;if("ref"in c)for(_ in c={},t)_=="ref"?l=t[_]:c[_]=t[_];var s={type:e,props:c,key:n,ref:l,__k:null,__:null,__b:0,__e:null,__c:null,constructor:void 0,__v:--ot,__i:-1,__u:0,__source:i,__self:r};if(typeof e=="function"&&(l=e.defaultProps))for(_ in l)c[_]===void 0&&(c[_]=l[_]);return v.vnode&&v.vnode(s),s}var at,it,st,oe,He=se((()=>{at="modulepreload",it=function(e){return"/"+e},st={},oe=function(t,n,o){let i=Promise.resolve();if(0)var l;function r(_){const c=new Event("vite:preloadError",{cancelable:!0});if(c.payload=_,window.dispatchEvent(c),!c.defaultPrevented)throw _}return i.then(_=>{for(const c of _||[])c.status==="rejected"&&r(c.reason);return t().catch(r)})}})),_t=ze({captureScreenshot:()=>lt});async function lt(){try{const e=(await oe(()=>import(Be),void 0)).default;if(!e)throw new Error("html2canvas: missing default export");return(await e(document.body,{logging:!1,useCORS:!0,scale:Math.min(window.devicePixelRatio||1,2)})).toDataURL("image/png")}catch(e){return console.warn("screenshot capture failed",e),null}}var Be,ct=se((()=>{He(),Be="https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/+esm"}));He();var dt=[{k:"auto",label:"auto",glyph:"⚡"},{k:"bug",label:"bug",glyph:"☒"},{k:"idea",label:"idea",glyph:"★"},{k:"ask",label:"ask",glyph:"?"}];function pt(e){const[t,n]=E(!1),[o,i]=E("compose"),[r,l]=E("auto"),[_,c]=E(""),[s,u]=E(""),[a,f]=E(!0),[d,b]=E(null),[w,x]=E(!1);Ye(()=>{let g=!1;return rt().then(C=>{g||x(C.remove_branding)}),()=>{g=!0}},[]);const h=()=>{n(!1),e.onClose?.()},m=()=>{i("compose"),c(""),b(null)},S=async()=>{i("sending"),b(null);let g;if(a){const{captureScreenshot:q}=await oe(async()=>{const{captureScreenshot:M}=await Promise.resolve().then(()=>(ct(),_t));return{captureScreenshot:M}},void 0);g=await q()??void 0}const C=await tt({message:_,pageUrl:window.location.href,userAgent:navigator.userAgent,email:s||void 0,kind:r,screenshotDataUrl:g});C.ok||b(C.status===429?"Too many submissions — try again in a minute.":"Could not send. Try again."),i("sent")};return p("div",{class:`wrap ${e.theme==="dark"?"theme-dark":""}`,children:p("div",{class:"stack",children:[t&&p("div",{class:"panel",children:[p("div",{class:"head",children:[p("strong",{class:"title",children:"Send feedback"}),p("span",{class:"spacer"}),p("button",{class:"x",onClick:h,"aria-label":"close",children:"×"})]}),o==="compose"&&p("div",{class:"body",children:[p("div",{class:"kinds",children:dt.map(g=>p("button",{class:r===g.k?"active":"",onClick:()=>l(g.k),type:"button",children:[p("span",{"aria-hidden":!0,children:g.glyph}),g.label]},g.k))}),p("div",{class:"textwrap",children:[p("textarea",{rows:4,value:_,onInput:g=>c(g.currentTarget.value),placeholder:"What's on your mind? We'll auto-classify."}),p("div",{class:"ctl",children:[p("label",{children:[p("span",{class:`check ${a?"on":""}`,children:a?"✓":""}),p("input",{type:"checkbox",checked:a,onChange:g=>f(g.currentTarget.checked),style:{display:"none"}}),"screenshot"]}),p("span",{class:"divider"}),p("span",{children:[_.length," / 2000"]}),p("span",{class:"spacer"}),p("span",{class:"tag",children:"markdown ok"})]})]}),p("div",{class:"email",children:[p("span",{class:"label",children:"reply to"}),p("input",{type:"email",value:s,onInput:g=>u(g.currentTarget.value),placeholder:"optional@email.com"})]}),p("div",{class:"foot",children:[w?p("span",{class:"spacer"}):p(N,{children:[p("a",{class:"brand",href:"https://usefeedbackbot.com/?ref=widget",target:"_blank",rel:"noopener noreferrer",children:"▣ Powered by FeedbackBot"}),p("span",{class:"spacer"})]}),p("button",{class:"btn primary",onClick:S,disabled:!_.trim(),type:"button",children:"send"})]})]}),o==="sending"&&p("div",{class:"pending",children:[p("div",{class:"hint",children:"routing"}),p("div",{class:"dots",children:[p("span",{}),p("span",{}),p("span",{})]})]}),o==="sent"&&p("div",{class:"sent",children:[p("div",{class:"badge","aria-hidden":!0,children:"✓"}),d?p(N,{children:[p("div",{class:"title",children:"Try again"}),p("div",{class:"err",children:d})]}):p(N,{children:[p("div",{class:"title",children:"Got it."}),p("div",{class:"sub",children:"Tagged and routed to your integrations."})]}),p("button",{class:"btn ghost",onClick:m,type:"button",children:"send another"})]})]}),p("button",{class:`bubble ${t?"open":""}`,onClick:()=>n(!t),"aria-label":"Feedback",type:"button",children:t?"×":"💬"})]})})}var ut=`
:host { all: initial; }

.wrap {
  position: fixed;
  right: 20px;
  bottom: 20px;
  max-width: calc(100vw - 32px);
  z-index: 2147483647;
  font-family: 'Space Grotesk', system-ui, sans-serif;
  color: #0a0a0a;

  --bg: #ffffff;
  --surface: #ffffff;
  --fg: #0a0a0a;
  --fg-mute: #3a362e;
  --fg-faint: #6b6356;
  --border: #0a0a0a;
  --border-soft: #b8b0a0;
  --accent: #ffe24a;
  --accent-ink: #0a0a0a;
  --danger: #c0391c;
}
.wrap.theme-dark {
  color: #f4f1ea;
  --bg: #0b0b0a;
  --surface: #141312;
  --fg: #f4f1ea;
  --fg-mute: #c4bdb0;
  --fg-faint: #9d9387;
  --border: #f4f1ea;
  --border-soft: #3a362e;
  --danger: #ff6a4a;
}

.stack {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 14px;
}

.panel {
  width: 360px;
  max-width: 100%;
  background: var(--surface);
  border: 2px solid var(--border);
  box-shadow: 6px 6px 0 0 var(--border);
  animation: slide-in .24s ease-out;
}
@keyframes slide-in {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: none; }
}

.head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  background: var(--accent);
  color: var(--accent-ink);
  border-bottom: 2px solid var(--border);
}
.head .title { font-weight: 700; font-size: 14px; letter-spacing: -0.01em; }
.head .spacer { flex: 1; }
.head .x {
  width: 24px; height: 24px;
  display: flex; align-items: center; justify-content: center;
  border: 1.5px solid var(--accent-ink);
  background: transparent;
  color: var(--accent-ink);
  cursor: pointer;
}

.body { padding: 16px; }

.kinds {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  border: 1.5px solid var(--border);
  margin-bottom: 14px;
}
.kinds button {
  padding: 8px 4px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  border: none;
  background: var(--surface);
  color: var(--fg);
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 11px; font-weight: 600;
  letter-spacing: 0.04em; text-transform: uppercase;
  cursor: pointer;
}
.kinds button + button { border-left: 1.5px solid var(--border); }
.kinds button.active { background: var(--fg); color: var(--bg); }

.textwrap { border: 2px solid var(--border); background: var(--surface); }
.textwrap textarea {
  width: 100%;
  border: none; resize: none; outline: none;
  padding: 10px 12px;
  font-size: 14px; line-height: 1.45;
  font-family: 'Space Grotesk', system-ui, sans-serif;
  background: transparent; color: var(--fg);
  box-sizing: border-box;
}
.textwrap .ctl {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 10px;
  border-top: 1.5px solid var(--border-soft);
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 11px; color: var(--fg-mute);
}
.ctl label { display: flex; align-items: center; gap: 6px; cursor: pointer; }
.ctl .check {
  width: 14px; height: 14px;
  border: 1.5px solid var(--border);
  display: flex; align-items: center; justify-content: center;
}
.ctl .check.on { background: var(--accent); }
.ctl .divider { width: 1px; height: 14px; background: var(--border-soft); }
.ctl .spacer { flex: 1; }
.ctl .tag { padding: 1px 6px; border: 1px solid var(--border-soft); }

.email {
  margin-top: 10px;
  display: flex; align-items: center; gap: 8px;
  border: 1.5px solid var(--border);
  padding: 8px 10px;
  background: var(--surface);
}
.email .label { font-family: 'JetBrains Mono', ui-monospace, monospace; font-size: 11px; color: var(--fg-faint); }
.email input {
  flex: 1; border: none; outline: none; background: transparent;
  font-family: 'JetBrains Mono', ui-monospace, monospace; font-size: 12px;
  color: var(--fg);
}

.foot {
  margin-top: 14px;
  display: flex; align-items: center; gap: 8px;
}
.foot .brand {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 10px; color: var(--fg-faint);
  text-decoration: none;
  letter-spacing: 0.04em;
}
.foot .brand:hover {
  color: var(--fg-mute);
  text-decoration: underline;
}
.foot .spacer { flex: 1; }

.btn {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 7px 14px;
  font-family: 'Space Grotesk', system-ui, sans-serif;
  font-weight: 600; font-size: 13px;
  border: 2px solid var(--border);
  background: var(--surface);
  color: var(--fg);
  box-shadow: 3px 3px 0 0 var(--border);
  cursor: pointer;
  white-space: nowrap;
  transition: transform .08s, box-shadow .08s;
}
.btn:hover { transform: translate(-1px, -1px); box-shadow: 4px 4px 0 0 var(--border); }
.btn:active { transform: translate(2px, 2px); box-shadow: 1px 1px 0 0 var(--border); }
.btn.primary {
  background: var(--accent); color: var(--accent-ink); border-color: var(--accent-ink);
  box-shadow: 3px 3px 0 0 var(--accent-ink);
}
.btn.primary:hover { box-shadow: 4px 4px 0 0 var(--accent-ink); }
.btn.primary:active { box-shadow: 1px 1px 0 0 var(--accent-ink); }
.btn.ghost { box-shadow: none; background: transparent; }
.btn[disabled] { opacity: 0.5; pointer-events: none; }

.pending { padding: 44px 16px; text-align: center; }
.pending .hint {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 12px; color: var(--fg-mute);
  letter-spacing: 0.1em; text-transform: uppercase;
}
.dots { margin-top: 10px; display: flex; justify-content: center; gap: 6px; }
.dots span {
  width: 8px; height: 8px; background: var(--fg);
  animation: bounce 1s infinite alternate;
}
.dots span:nth-child(2) { animation-delay: .12s; }
.dots span:nth-child(3) { animation-delay: .24s; }
@keyframes bounce { from { opacity: .2; } to { opacity: 1; } }

.sent { padding: 24px 16px 18px; text-align: center; }
.sent .badge {
  width: 44px; height: 44px; margin: 0 auto 10px;
  background: var(--accent); color: var(--accent-ink);
  border: 2px solid var(--accent-ink);
  display: flex; align-items: center; justify-content: center;
  box-shadow: 3px 3px 0 0 var(--accent-ink);
}
.sent .title { font-size: 20px; font-weight: 700; letter-spacing: -0.03em; margin-bottom: 4px; }
.sent .sub { font-size: 13px; color: var(--fg-mute); margin-bottom: 14px; }
.sent .err { color: var(--danger); font-size: 13px; margin-bottom: 14px; }

.bubble {
  width: 56px; height: 56px;
  background: var(--accent); color: var(--accent-ink);
  border: 2px solid var(--border);
  box-shadow: 4px 4px 0 0 var(--border);
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
  transition: transform .08s, box-shadow .08s;
}
.bubble.open { background: var(--surface); color: var(--fg); }
.bubble:active { transform: translate(2px, 2px); box-shadow: 2px 2px 0 0 var(--border); }
`,Re="data-feedbackbot",Ie=(()=>{try{return document.currentScript?.src??""}catch{return""}})();function ft(){if(Ie)try{return new URL(Ie).origin}catch{}return""}function je(){if(document.querySelector(`[${Re}]`))return;window.__FEEDBACKBOT_ORIGIN__||(window.__FEEDBACKBOT_ORIGIN__=ft());const e=document.createElement("div");e.setAttribute(Re,"1"),document.body.appendChild(e);const t=e.attachShadow({mode:"open"}),n=document.createElement("style");n.textContent=ut,t.appendChild(n);const o=document.createElement("div");t.appendChild(o),Ve(ue(pt,{theme:document.documentElement.dataset.theme==="dark"?"dark":"light"}),o)}document.readyState==="loading"?document.addEventListener("DOMContentLoaded",je,{once:!0}):je()})();
