self.addEventListener("install",e=>{}),self.addEventListener("fetch",e=>{"https://kanshi.vercel.app/_vercel/insights/script.js"!==e.request.url&&e.respondWith(fetch(e.request).catch(e=>{}))});