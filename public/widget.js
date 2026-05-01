(function(){var le=Object.defineProperty,_e=(e,t)=>()=>(e&&(t=e(e=0)),t),We=(e,t)=>{let n={};for(var r in e)le(n,r,{get:e[r],enumerable:!0});return t||le(n,Symbol.toStringTag,{value:"Module"}),n},B,v,ce,Ge,E,de,pe,ue,Y,L,H,fe,Q,X,Z,qe,z={},j=[],Je=/acit|ex(?:s|g|n|p|$)|rph|grid|ows|mnc|ntw|ine[ch]|zoo|^ord|itera/i,O=Array.isArray;function T(e,t){for(var n in t)e[n]=t[n];return e}function ee(e){e&&e.parentNode&&e.parentNode.removeChild(e)}function he(e,t,n){var r,i,o,_={};for(o in t)o=="key"?r=t[o]:o=="ref"?i=t[o]:_[o]=t[o];if(arguments.length>2&&(_.children=arguments.length>3?B.call(arguments,2):n),typeof e=="function"&&e.defaultProps!=null)for(o in e.defaultProps)_[o]===void 0&&(_[o]=e.defaultProps[o]);return F(e,_,r,i,null)}function F(e,t,n,r,i){var o={type:e,props:t,key:n,ref:r,__k:null,__:null,__b:0,__e:null,__c:null,constructor:void 0,__v:i??++ce,__i:-1,__u:0};return i==null&&v.vnode!=null&&v.vnode(o),o}function U(e){return e.children}function W(e,t){this.props=e,this.context=t}function M(e,t){if(t==null)return e.__?M(e.__,e.__i+1):null;for(var n;t<e.__k.length;t++)if((n=e.__k[t])!=null&&n.__e!=null)return n.__e;return typeof e.type=="function"?M(e):null}function Ke(e){if(e.__P&&e.__d){var t=e.__v,n=t.__e,r=[],i=[],o=T({},t);o.__v=t.__v+1,v.vnode&&v.vnode(o),te(e.__P,o,t,e.__n,e.__P.namespaceURI,32&t.__u?[n]:null,r,n??M(t),!!(32&t.__u),i),o.__v=t.__v,o.__.__k[o.__i]=o,ke(r,o,i),t.__e=t.__=null,o.__e!=n&&me(o)}}function me(e){if((e=e.__)!=null&&e.__c!=null)return e.__e=e.__c.base=null,e.__k.some(function(t){if(t!=null&&t.__e!=null)return e.__e=e.__c.base=t.__e}),me(e)}function ve(e){(!e.__d&&(e.__d=!0)&&E.push(e)&&!G.__r++||de!=v.debounceRendering)&&((de=v.debounceRendering)||pe)(G)}function G(){try{for(var e,t=1;E.length;)E.length>t&&E.sort(ue),e=E.shift(),t=E.length,Ke(e)}finally{E.length=G.__r=0}}function ge(e,t,n,r,i,o,_,l,c,s,u){var a,f,d,g,w,x,h,m=r&&r.__k||j,S=t.length;for(c=Ve(n,t,m,c,S),a=0;a<S;a++)(d=n.__k[a])!=null&&(f=d.__i!=-1&&m[d.__i]||z,d.__i=a,x=te(e,d,f,i,o,_,l,c,s,u),g=d.__e,d.ref&&f.ref!=d.ref&&(f.ref&&re(f.ref,null,d),u.push(d.ref,d.__c||g,d)),w==null&&g!=null&&(w=g),(h=!!(4&d.__u))||f.__k===d.__k?(c=be(d,c,e,h),h&&f.__e&&(f.__e=null)):typeof d.type=="function"&&x!==void 0?c=x:g&&(c=g.nextSibling),d.__u&=-7);return n.__e=w,c}function Ve(e,t,n,r,i){var o,_,l,c,s,u=n.length,a=u,f=0;for(e.__k=new Array(i),o=0;o<i;o++)(_=t[o])!=null&&typeof _!="boolean"&&typeof _!="function"?(typeof _=="string"||typeof _=="number"||typeof _=="bigint"||_.constructor==String?_=e.__k[o]=F(null,_,null,null,null):O(_)?_=e.__k[o]=F(U,{children:_},null,null,null):_.constructor===void 0&&_.__b>0?_=e.__k[o]=F(_.type,_.props,_.key,_.ref?_.ref:null,_.__v):e.__k[o]=_,c=o+f,_.__=e,_.__b=e.__b+1,l=null,(s=_.__i=Ye(_,n,c,a))!=-1&&(a--,(l=n[s])&&(l.__u|=2)),l==null||l.__v==null?(s==-1&&(i>u?f--:i<u&&f++),typeof _.type!="function"&&(_.__u|=4)):s!=c&&(s==c-1?f--:s==c+1?f++:(s>c?f--:f++,_.__u|=4))):e.__k[o]=null;if(a)for(o=0;o<u;o++)(l=n[o])!=null&&(2&l.__u)==0&&(l.__e==r&&(r=M(l)),Se(l,l));return r}function be(e,t,n,r){var i,o;if(typeof e.type=="function"){for(i=e.__k,o=0;i&&o<i.length;o++)i[o]&&(i[o].__=e,t=be(i[o],t,n,r));return t}e.__e!=t&&(r&&(t&&e.type&&!t.parentNode&&(t=M(e)),n.insertBefore(e.__e,t||null)),t=e.__e);do t=t&&t.nextSibling;while(t!=null&&t.nodeType==8);return t}function Ye(e,t,n,r){var i,o,_,l=e.key,c=e.type,s=t[n],u=s!=null&&(2&s.__u)==0;if(s===null&&l==null||u&&l==s.key&&c==s.type)return n;if(r>(u?1:0)){for(i=n-1,o=n+1;i>=0||o<t.length;)if((s=t[_=i>=0?i--:o++])!=null&&(2&s.__u)==0&&l==s.key&&c==s.type)return _}return-1}function ye(e,t,n){t[0]=="-"?e.setProperty(t,n??""):e[t]=n==null?"":typeof n!="number"||Je.test(t)?n:n+"px"}function q(e,t,n,r,i){var o,_;e:if(t=="style")if(typeof n=="string")e.style.cssText=n;else{if(typeof r=="string"&&(e.style.cssText=r=""),r)for(t in r)n&&t in n||ye(e.style,t,"");if(n)for(t in n)r&&n[t]==r[t]||ye(e.style,t,n[t])}else if(t[0]=="o"&&t[1]=="n")o=t!=(t=t.replace(fe,"$1")),_=t.toLowerCase(),t=_ in e||t=="onFocusOut"||t=="onFocusIn"?_.slice(2):t.slice(2),e.l||(e.l={}),e.l[t+o]=n,n?r?n[H]=r[H]:(n[H]=Q,e.addEventListener(t,o?Z:X,o)):e.removeEventListener(t,o?Z:X,o);else{if(i=="http://www.w3.org/2000/svg")t=t.replace(/xlink(H|:h)/,"h").replace(/sName$/,"s");else if(t!="width"&&t!="height"&&t!="href"&&t!="list"&&t!="form"&&t!="tabIndex"&&t!="download"&&t!="rowSpan"&&t!="colSpan"&&t!="role"&&t!="popover"&&t in e)try{e[t]=n??"";break e}catch{}typeof n=="function"||(n==null||n===!1&&t[4]!="-"?e.removeAttribute(t):e.setAttribute(t,t=="popover"&&n==1?"":n))}}function xe(e){return function(t){if(this.l){var n=this.l[t.type+e];if(t[L]==null)t[L]=Q++;else if(t[L]<n[H])return;return n(v.event?v.event(t):t)}}}function te(e,t,n,r,i,o,_,l,c,s){var u,a,f,d,g,w,x,h,m,S,$,b,A,N,I,C=t.type;if(t.constructor!==void 0)return null;128&n.__u&&(c=!!(32&n.__u),o=[l=t.__e=n.__e]),(u=v.__b)&&u(t);e:if(typeof C=="function")try{if(h=t.props,m=C.prototype&&C.prototype.render,S=(u=C.contextType)&&r[u.__c],$=u?S?S.props.value:u.__:r,n.__c?x=(a=t.__c=n.__c).__=a.__E:(m?t.__c=a=new C(h,$):(t.__c=a=new W(h,$),a.constructor=C,a.render=Xe),S&&S.sub(a),a.state||(a.state={}),a.__n=r,f=a.__d=!0,a.__h=[],a._sb=[]),m&&a.__s==null&&(a.__s=a.state),m&&C.getDerivedStateFromProps!=null&&(a.__s==a.state&&(a.__s=T({},a.__s)),T(a.__s,C.getDerivedStateFromProps(h,a.__s))),d=a.props,g=a.state,a.__v=t,f)m&&C.getDerivedStateFromProps==null&&a.componentWillMount!=null&&a.componentWillMount(),m&&a.componentDidMount!=null&&a.__h.push(a.componentDidMount);else{if(m&&C.getDerivedStateFromProps==null&&h!==d&&a.componentWillReceiveProps!=null&&a.componentWillReceiveProps(h,$),t.__v==n.__v||!a.__e&&a.shouldComponentUpdate!=null&&a.shouldComponentUpdate(h,a.__s,$)===!1){t.__v!=n.__v&&(a.props=h,a.state=a.__s,a.__d=!1),t.__e=n.__e,t.__k=n.__k,t.__k.some(function(D){D&&(D.__=t)}),j.push.apply(a.__h,a._sb),a._sb=[],a.__h.length&&_.push(a);break e}a.componentWillUpdate!=null&&a.componentWillUpdate(h,a.__s,$),m&&a.componentDidUpdate!=null&&a.__h.push(function(){a.componentDidUpdate(d,g,w)})}if(a.context=$,a.props=h,a.__P=e,a.__e=!1,b=v.__r,A=0,m)a.state=a.__s,a.__d=!1,b&&b(t),u=a.render(a.props,a.state,a.context),j.push.apply(a.__h,a._sb),a._sb=[];else do a.__d=!1,b&&b(t),u=a.render(a.props,a.state,a.context),a.state=a.__s;while(a.__d&&++A<25);a.state=a.__s,a.getChildContext!=null&&(r=T(T({},r),a.getChildContext())),m&&!f&&a.getSnapshotBeforeUpdate!=null&&(w=a.getSnapshotBeforeUpdate(d,g)),N=u!=null&&u.type===U&&u.key==null?we(u.props.children):u,l=ge(e,O(N)?N:[N],t,n,r,i,o,_,l,c,s),a.base=t.__e,t.__u&=-161,a.__h.length&&_.push(a),x&&(a.__E=a.__=null)}catch(D){if(t.__v=null,c||o!=null)if(D.then){for(t.__u|=c?160:128;l&&l.nodeType==8&&l.nextSibling;)l=l.nextSibling;o[o.indexOf(l)]=null,t.__e=l}else{for(I=o.length;I--;)ee(o[I]);ne(t)}else t.__e=n.__e,t.__k=n.__k,D.then||ne(t);v.__e(D,t,n)}else o==null&&t.__v==n.__v?(t.__k=n.__k,t.__e=n.__e):l=t.__e=Qe(n.__e,t,n,r,i,o,_,c,s);return(u=v.diffed)&&u(t),128&t.__u?void 0:l}function ne(e){e&&(e.__c&&(e.__c.__e=!0),e.__k&&e.__k.some(ne))}function ke(e,t,n){for(var r=0;r<n.length;r++)re(n[r],n[++r],n[++r]);v.__c&&v.__c(t,e),e.some(function(i){try{e=i.__h,i.__h=[],e.some(function(o){o.call(i)})}catch(o){v.__e(o,i.__v)}})}function we(e){return typeof e!="object"||e==null||e.__b>0?e:O(e)?e.map(we):T({},e)}function Qe(e,t,n,r,i,o,_,l,c){var s,u,a,f,d,g,w,x=n.props||z,h=t.props,m=t.type;if(m=="svg"?i="http://www.w3.org/2000/svg":m=="math"?i="http://www.w3.org/1998/Math/MathML":i||(i="http://www.w3.org/1999/xhtml"),o!=null){for(s=0;s<o.length;s++)if((d=o[s])&&"setAttribute"in d==!!m&&(m?d.localName==m:d.nodeType==3)){e=d,o[s]=null;break}}if(e==null){if(m==null)return document.createTextNode(h);e=document.createElementNS(i,m,h.is&&h),l&&(v.__m&&v.__m(t,o),l=!1),o=null}if(m==null)x===h||l&&e.data==h||(e.data=h);else{if(o=o&&B.call(e.childNodes),!l&&o!=null)for(x={},s=0;s<e.attributes.length;s++)x[(d=e.attributes[s]).name]=d.value;for(s in x)d=x[s],s=="dangerouslySetInnerHTML"?a=d:s=="children"||s in h||s=="value"&&"defaultValue"in h||s=="checked"&&"defaultChecked"in h||q(e,s,null,d,i);for(s in h)d=h[s],s=="children"?f=d:s=="dangerouslySetInnerHTML"?u=d:s=="value"?g=d:s=="checked"?w=d:l&&typeof d!="function"||x[s]===d||q(e,s,d,x[s],i);if(u)l||a&&(u.__html==a.__html||u.__html==e.innerHTML)||(e.innerHTML=u.__html),t.__k=[];else if(a&&(e.innerHTML=""),ge(t.type=="template"?e.content:e,O(f)?f:[f],t,n,r,m=="foreignObject"?"http://www.w3.org/1999/xhtml":i,o,_,o?o[0]:n.__k&&M(n,0),l,c),o!=null)for(s=o.length;s--;)ee(o[s]);l||(s="value",m=="progress"&&g==null?e.removeAttribute("value"):g!=null&&(g!==e[s]||m=="progress"&&!g||m=="option"&&g!=x[s])&&q(e,s,g,x[s],i),s="checked",w!=null&&w!=e[s]&&q(e,s,w,x[s],i))}return e}function re(e,t,n){try{if(typeof e=="function"){var r=typeof e.__u=="function";r&&e.__u(),r&&t==null||(e.__u=e(t))}else e.current=t}catch(i){v.__e(i,n)}}function Se(e,t,n){var r,i;if(v.unmount&&v.unmount(e),(r=e.ref)&&(r.current&&r.current!=e.__e||re(r,null,t)),(r=e.__c)!=null){if(r.componentWillUnmount)try{r.componentWillUnmount()}catch(o){v.__e(o,t)}r.base=r.__P=null}if(r=e.__k)for(i=0;i<r.length;i++)r[i]&&Se(r[i],t,n||typeof e.type!="function");n||ee(e.__e),e.__c=e.__=e.__e=void 0}function Xe(e,t,n){return this.constructor(e,n)}function Ze(e,t,n){var r,i,o,_;t==document&&(t=document.documentElement),v.__&&v.__(e,t),i=(r=typeof n=="function")?null:n&&n.__k||t.__k,o=[],_=[],te(t,e=(!r&&n||t).__k=he(U,null,[e]),i||z,z,t.namespaceURI,!r&&n?[n]:i?null:t.firstChild?B.call(t.childNodes):null,o,!r&&n?n:i?i.__e:t.firstChild,r,_),ke(o,e,_)}B=j.slice,v={__e:function(e,t,n,r){for(var i,o,_;t=t.__;)if((i=t.__c)&&!i.__)try{if((o=i.constructor)&&o.getDerivedStateFromError!=null&&(i.setState(o.getDerivedStateFromError(e)),_=i.__d),i.componentDidCatch!=null&&(i.componentDidCatch(e,r||{}),_=i.__d),_)return i.__E=i}catch(l){e=l}throw e}},ce=0,Ge=function(e){return e!=null&&e.constructor===void 0},W.prototype.setState=function(e,t){var n=this.__s!=null&&this.__s!=this.state?this.__s:this.__s=T({},this.state);typeof e=="function"&&(e=e(T({},n),this.props)),e&&T(n,e),e!=null&&this.__v&&(t&&this._sb.push(t),ve(this))},W.prototype.forceUpdate=function(e){this.__v&&(this.__e=!0,e&&this.__h.push(e),ve(this))},W.prototype.render=U,E=[],pe=typeof Promise=="function"?Promise.prototype.then.bind(Promise.resolve()):setTimeout,ue=function(e,t){return e.__v.__b-t.__v.__b},G.__r=0,Y=Math.random().toString(8),L="__d"+Y,H="__a"+Y,fe=/(PointerCapture)$|Capture$/i,Q=0,X=xe(!1),Z=xe(!0),qe=0;var R,y,oe,Ce,J=0,Te=[],k=v,$e=k.__b,Ee=k.__r,Pe=k.diffed,Ne=k.__c,Ue=k.unmount,Ae=k.__;function ae(e,t){k.__h&&k.__h(y,e,J||t),J=0;var n=y.__H||(y.__H={__:[],__h:[]});return e>=n.__.length&&n.__.push({}),n.__[e]}function P(e){return J=1,et(He,e)}function et(e,t,n){var r=ae(R++,2);if(r.t=e,!r.__c&&(r.__=[n?n(t):He(void 0,t),function(l){var c=r.__N?r.__N[0]:r.__[0],s=r.t(c,l);c!==s&&(r.__N=[s,r.__[1]],r.__c.setState({}))}],r.__c=y,!y.__f)){var i=function(l,c,s){if(!r.__c.__H)return!0;var u=r.__c.__H.__.filter(function(f){return f.__c});if(u.every(function(f){return!f.__N}))return!o||o.call(this,l,c,s);var a=r.__c.props!==l;return u.some(function(f){if(f.__N){var d=f.__[0];f.__=f.__N,f.__N=void 0,d!==f.__[0]&&(a=!0)}}),o&&o.call(this,l,c,s)||a};y.__f=!0;var o=y.shouldComponentUpdate,_=y.componentWillUpdate;y.componentWillUpdate=function(l,c,s){if(this.__e){var u=o;o=void 0,i(l,c,s),o=u}_&&_.call(this,l,c,s)},y.shouldComponentUpdate=i}return r.__N||r.__}function tt(e,t){var n=ae(R++,3);!k.__s&&De(n.__H,t)&&(n.__=e,n.u=t,y.__H.__h.push(n))}function nt(e){return J=5,rt(function(){return{current:e}},[])}function rt(e,t){var n=ae(R++,7);return De(n.__H,t)&&(n.__=e(),n.__H=t,n.__h=e),n.__}function ot(){for(var e;e=Te.shift();){var t=e.__H;if(e.__P&&t)try{t.__h.some(K),t.__h.some(ie),t.__h=[]}catch(n){t.__h=[],k.__e(n,e.__v)}}}k.__b=function(e){y=null,$e&&$e(e)},k.__=function(e,t){e&&t.__k&&t.__k.__m&&(e.__m=t.__k.__m),Ae&&Ae(e,t)},k.__r=function(e){Ee&&Ee(e),R=0;var t=(y=e.__c).__H;t&&(oe===y?(t.__h=[],y.__h=[],t.__.some(function(n){n.__N&&(n.__=n.__N),n.u=n.__N=void 0})):(t.__h.some(K),t.__h.some(ie),t.__h=[],R=0)),oe=y},k.diffed=function(e){Pe&&Pe(e);var t=e.__c;t&&t.__H&&(t.__H.__h.length&&(Te.push(t)!==1&&Ce===k.requestAnimationFrame||((Ce=k.requestAnimationFrame)||at)(ot)),t.__H.__.some(function(n){n.u&&(n.__H=n.u),n.u=void 0})),oe=y=null},k.__c=function(e,t){t.some(function(n){try{n.__h.some(K),n.__h=n.__h.filter(function(r){return!r.__||ie(r)})}catch(r){t.some(function(i){i.__h&&(i.__h=[])}),t=[],k.__e(r,n.__v)}}),Ne&&Ne(e,t)},k.unmount=function(e){Ue&&Ue(e);var t,n=e.__c;n&&n.__H&&(n.__H.__.some(function(r){try{K(r)}catch(i){t=i}}),n.__H=void 0,t&&k.__e(t,n.__v))};var Me=typeof requestAnimationFrame=="function";function at(e){var t,n=function(){clearTimeout(r),Me&&cancelAnimationFrame(t),setTimeout(e)},r=setTimeout(n,35);Me&&(t=requestAnimationFrame(n))}function K(e){var t=y,n=e.__c;typeof n=="function"&&(e.__c=void 0,n()),y=t}function ie(e){var t=y;e.__c=e.__(),y=t}function De(e,t){return!e||e.length!==t.length||t.some(function(n,r){return n!==e[r]})}function He(e,t){return typeof t=="function"?t(e):t}var Re=typeof window<"u"&&window.__FEEDBACKBOT_ORIGIN__||"";async function it(e){const t={message:e.message,page_url:e.pageUrl,user_agent:e.userAgent,email:e.email??"",honeypot:"",want_screenshot_upload:!!e.screenshotDataUrl,turnstile_token:e.turnstileToken??""};try{const n=await fetch(`${Re}/api/ticket`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(t)});if(!n.ok)return{ok:!1,status:n.status,message:`HTTP ${n.status}`};const r=await n.json();return e.screenshotDataUrl&&r.screenshot_upload_url&&await st(r.screenshot_upload_url,e.screenshotDataUrl),{ok:!0,ticketId:r.ticket_id,routedTo:null}}catch(n){return{ok:!1,status:0,message:n instanceof Error?n.message:"network"}}}async function st(e,t){const n=await(await fetch(t)).blob();await fetch(e,{method:"PUT",headers:{"content-type":"image/png"},body:n}).catch(()=>{})}async function lt(){try{const e=await fetch(`${Re}/api/widget-config`);return e.ok?await e.json():{plan:null,remove_branding:!1}}catch{return{plan:null,remove_branding:!1}}}var Ie="",_t="https://challenges.cloudflare.com/turnstile/v0/api.js",Be=Ie!=="",V=null;function ct(){return V||(V=new Promise((e,t)=>{if(window.turnstile){e(window.turnstile);return}const n=document.createElement("script");n.src=_t,n.async=!0,n.defer=!0,n.onload=()=>{window.turnstile?e(window.turnstile):t(new Error("turnstile script loaded but global missing"))},n.onerror=()=>t(new Error("turnstile script failed to load")),document.head.appendChild(n)}),V)}async function dt(e){if(!Be)return"";try{const t=await ct();return await new Promise(n=>{const r=t.render(e,{sitekey:Ie,size:"invisible",callback:i=>{try{t.remove(r)}catch{}n(i)},"error-callback":()=>n(""),"expired-callback":()=>n("")});try{t.execute(r)}catch{n("")}})}catch(t){return console.warn("feedbackbot: turnstile mint failed",t),""}}var wt=/acit|ex(?:s|g|n|p|$)|rph|grid|ows|mnc|ntw|ine[ch]|zoo|^ord|itera/i,pt=0,St=Array.isArray;function p(e,t,n,r,i,o){t||(t={});var _,l,c=t;if("ref"in c)for(l in c={},t)l=="ref"?_=t[l]:c[l]=t[l];var s={type:e,props:c,key:n,ref:_,__k:null,__:null,__b:0,__e:null,__c:null,constructor:void 0,__v:--pt,__i:-1,__u:0,__source:i,__self:o};if(typeof e=="function"&&(_=e.defaultProps))for(l in _)c[l]===void 0&&(c[l]=_[l]);return v.vnode&&v.vnode(s),s}var ut,ft,ht,se,Le=_e((()=>{ut="modulepreload",ft=function(e){return"/"+e},ht={},se=function(t,n,r){let i=Promise.resolve();if(0)var _;function o(l){const c=new Event("vite:preloadError",{cancelable:!0});if(c.payload=l,window.dispatchEvent(c),!c.defaultPrevented)throw l}return i.then(l=>{for(const c of l||[])c.status==="rejected"&&o(c.reason);return t().catch(o)})}})),mt=We({captureScreenshot:()=>vt});async function vt(){try{const e=(await se(()=>import(ze),void 0)).default;if(!e)throw new Error("html2canvas: missing default export");return(await e(document.body,{logging:!1,useCORS:!0,scale:Math.min(window.devicePixelRatio||1,2)})).toDataURL("image/png")}catch(e){return console.warn("screenshot capture failed",e),null}}var ze,gt=_e((()=>{Le(),ze="https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/+esm"}));Le();var bt=[{k:"auto",label:"auto",glyph:"⚡"},{k:"bug",label:"bug",glyph:"☒"},{k:"idea",label:"idea",glyph:"★"},{k:"ask",label:"ask",glyph:"?"}];function yt(e){const[t,n]=P(!1),[r,i]=P("compose"),[o,_]=P("auto"),[l,c]=P(""),[s,u]=P(""),[a,f]=P(!0),[d,g]=P(null),[w,x]=P(!1);tt(()=>{let b=!1;return lt().then(A=>{b||x(A.remove_branding)}),()=>{b=!0}},[]);const h=()=>{n(!1),e.onClose?.()},m=()=>{i("compose"),c(""),g(null)},S=nt(null),$=async()=>{i("sending"),g(null);let b;if(a){const{captureScreenshot:I}=await se(async()=>{const{captureScreenshot:C}=await Promise.resolve().then(()=>(gt(),mt));return{captureScreenshot:C}},void 0);b=await I()??void 0}let A="";Be&&S.current&&(A=await dt(S.current));const N=await it({message:l,pageUrl:window.location.href,userAgent:navigator.userAgent,email:s||void 0,kind:o,screenshotDataUrl:b,turnstileToken:A});N.ok?i("sent"):(g(N.status===429?"Too many submissions — try again in a minute.":N.status===403?"Couldn't verify — please refresh and try again.":"Could not send. Try again."),i("compose"))};return p("div",{class:`wrap ${e.theme==="dark"?"theme-dark":""}`,children:[p("div",{ref:S,style:"position:absolute;width:0;height:0;overflow:hidden;","aria-hidden":!0}),p("div",{class:"stack",children:[t&&p("div",{class:"panel",children:[p("div",{class:"head",children:[p("strong",{class:"title",children:"Send feedback"}),p("span",{class:"spacer"}),p("button",{class:"x",onClick:h,"aria-label":"close",children:"×"})]}),r==="compose"&&p("div",{class:"body",children:[p("div",{class:"kinds",children:bt.map(b=>p("button",{class:o===b.k?"active":"",onClick:()=>_(b.k),type:"button",children:[p("span",{"aria-hidden":!0,children:b.glyph}),b.label]},b.k))}),p("div",{class:"textwrap",children:[p("textarea",{rows:4,value:l,onInput:b=>c(b.currentTarget.value),placeholder:"What's on your mind? We'll auto-classify."}),p("div",{class:"ctl",children:[p("label",{children:[p("span",{class:`check ${a?"on":""}`,children:a?"✓":""}),p("input",{type:"checkbox",checked:a,onChange:b=>f(b.currentTarget.checked),style:{display:"none"}}),"screenshot"]}),p("span",{class:"divider"}),p("span",{children:[l.length," / 2000"]}),p("span",{class:"spacer"}),p("span",{class:"tag",children:"markdown ok"})]})]}),p("div",{class:"email",children:[p("span",{class:"label",children:"reply to"}),p("input",{type:"email",value:s,onInput:b=>u(b.currentTarget.value),placeholder:"optional@email.com"})]}),d&&p("div",{class:"err",role:"alert",children:d}),p("div",{class:"foot",children:[w?p("span",{class:"spacer"}):p(U,{children:[p("a",{class:"brand",href:"https://usefeedbackbot.com/?ref=widget",target:"_blank",rel:"noopener noreferrer",children:"▣ Powered by FeedbackBot"}),p("span",{class:"spacer"})]}),p("button",{class:"btn primary",onClick:$,disabled:!l.trim(),type:"button",children:"send"})]})]}),r==="sending"&&p("div",{class:"pending",children:[p("div",{class:"hint",children:"routing"}),p("div",{class:"dots",children:[p("span",{}),p("span",{}),p("span",{})]})]}),r==="sent"&&p("div",{class:"sent",children:[p("div",{class:"badge","aria-hidden":!0,children:"✓"}),d?p(U,{children:[p("div",{class:"title",children:"Try again"}),p("div",{class:"err",children:d})]}):p(U,{children:[p("div",{class:"title",children:"Got it."}),p("div",{class:"sub",children:"Tagged and routed to your integrations."})]}),p("button",{class:"btn ghost",onClick:m,type:"button",children:"send another"})]})]}),p("button",{class:`bubble ${t?"open":""}`,onClick:()=>n(!t),"aria-label":"Feedback",type:"button",children:t?"×":"💬"})]})]})}var xt=`
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
`,je="data-feedbackbot",Oe=(()=>{try{return document.currentScript?.src??""}catch{return""}})();function kt(){if(Oe)try{return new URL(Oe).origin}catch{}return""}function Fe(){if(document.querySelector(`[${je}]`))return;window.__FEEDBACKBOT_ORIGIN__||(window.__FEEDBACKBOT_ORIGIN__=kt());const e=document.createElement("div");e.setAttribute(je,"1"),document.body.appendChild(e);const t=e.attachShadow({mode:"open"}),n=document.createElement("style");n.textContent=xt,t.appendChild(n);const r=document.createElement("div");t.appendChild(r),Ze(he(yt,{theme:document.documentElement.dataset.theme==="dark"?"dark":"light"}),r)}document.readyState==="loading"?document.addEventListener("DOMContentLoaded",Fe,{once:!0}):Fe()})();
