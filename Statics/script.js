// script.js - Interactive Features, Dynamic Background, and GSAP Animations
document.addEventListener('DOMContentLoaded', function() {

    // Page intro animation
    gsap.from("body", {
        opacity: 0,
        duration: 0.8,
        ease: "power2.out"
    });
    
    // Register GSAP ScrollTrigger plugin
    gsap.registerPlugin(ScrollTrigger);

    // --- Dynamic padding-top for navbar offset and smooth anchor scroll ---
    const navbar = document.querySelector('.navbar');
    const mainContentWrapper = document.querySelector('.main-content-wrapper');

    // For pages WITH .main-content-wrapper (book, about, services, help) padding goes on wrapper.
    // For pages WITHOUT it (index, projects) padding goes on body.
    function adjustContentPadding() {
        if (!navbar) return;
        const h = navbar.offsetHeight;
        if (mainContentWrapper) {
            mainContentWrapper.style.paddingTop = h + 'px';
        } else {
            document.body.style.paddingTop = h + 'px';
        }
    }

    window.addEventListener('load', adjustContentPadding);
    window.addEventListener('resize', adjustContentPadding);
    adjustContentPadding();

    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            if (targetId === '#') return;

            const targetElement = document.querySelector(targetId);
            if (!targetElement) return;
            const navbarHeight = navbar ? navbar.offsetHeight : 0;

            if (mainContentWrapper) {
                const scrollTarget = targetElement.getBoundingClientRect().top + mainContentWrapper.scrollTop - navbarHeight;
                gsap.to(mainContentWrapper, { duration: 1, scrollTop: scrollTarget, ease: "power2.out" });
            } else {
                const scrollTarget = targetElement.getBoundingClientRect().top + window.scrollY - navbarHeight;
                window.scrollTo({ top: scrollTarget, behavior: 'smooth' });
            }
        });
    });

    // --- Navbar background on scroll ---
    const scrollContainer = mainContentWrapper || window;

    function handleNavbarScroll() {
        if (!navbar) return;
        const scrollY = mainContentWrapper ? mainContentWrapper.scrollTop : window.scrollY;
        if (scrollY > 100) {
            navbar.style.backgroundColor = 'rgba(31,40,51,0.95)';
            navbar.style.backdropFilter = 'blur(20px)';
        } else {
            navbar.style.backgroundColor = 'rgb(31,40,51)';
            navbar.style.backdropFilter = 'none';
        }
    }

    scrollContainer.addEventListener('scroll', handleNavbarScroll);

    // --- 3D Neural Network Background (Canvas 2D simulation) ---
    // (Code adapted from neural-bg.html)

    // ═══════════════════════════════════════════════════════════════════
    //  CONFIG
    // ═══════════════════════════════════════════════════════════════════
    const CFG = {
        baseCount:      150,      // Slightly reduced base particle count for better performance
        baseConnectDist3D:  350,      // Slightly reduced base connection range
        fov:            520,
        speed:          0.5,
        drag:           0.965,
        depth:          700,

        mouseRadius:    230,      // 3D attraction radius
        mouseStrength:  2.2,
        repelRadius:    340,
        repelStrength:  16,

        turbulence:     0.016,
        wobbleStrength: 0.009,

        light: { x: 0.62, y: -0.38 },

        CYAN:  [102, 252, 241],
        TEAL:  [69,  162, 158],

        // Dynamic config (will be set on resize/init)
        count: 0,
        connectDist3D: 0,
    };

    // ═══════════════════════════════════════════════════════════════════
    //  CANVAS
    // ═══════════════════════════════════════════════════════════════════
    const canvas = document.getElementById('neural-network-canvas');
    const ctx    = canvas ? canvas.getContext('2d') : null;
    let W, H, cx, cy;
    let particles = [];
    let pairAlpha;

    if (canvas && ctx) { // Only proceed if canvas and context exist
        // Function to dynamically adjust CFG values based on screen size
        function adjustConfig() {
            if (window.innerWidth < 768) { // Mobile
                CFG.count = Math.floor(CFG.baseCount * 0.4); // 40% particles
                CFG.connectDist3D = Math.floor(CFG.baseConnectDist3D * 0.6); // 60% connection range
            } else if (window.innerWidth < 1200) { // Tablet
                CFG.count = Math.floor(CFG.baseCount * 0.7); // 70% particles
                CFG.connectDist3D = Math.floor(CFG.baseConnectDist3D * 0.8); // 80% connection range
            } else { // Desktop
                CFG.count = CFG.baseCount;
                CFG.connectDist3D = CFG.baseConnectDist3D;
            }
            // Reinitialize particles if count changes or it's the first run
            if (particles.length === 0 || particles.length !== CFG.count) {
                particles = Array.from({ length: CFG.count }, () => new Particle());
                pairAlpha = new Float32Array(CFG.count * CFG.count);
            }
        }

        function resize() {
            W = canvas.width  = window.innerWidth;
            H = canvas.height = window.innerHeight;
            cx = W / 2;
            cy = H / 2;
            adjustConfig(); // Adjust config on resize
        }
        window.addEventListener('resize', resize);
        resize(); // Initial resize and config adjustment

        // ═══════════════════════════════════════════════════════════════════
        //  SCENE STATE
        // ═══════════════════════════════════════════════════════════════════
        let rotX = 0.18, rotY = 0.0;
        let zoom  = 1.75;
        let frame = 0;
        let lastMouseFrame = -9999;

        const mouseSCR  = { x: cx, y: cy };
        const mouse3D   = { x: 0, y: 0, z: 0, active: false };
        const cursorPos = { x: cx, y: cy };

        // ═══════════════════════════════════════════════════════════════════
        //  PARTICLE CLASS
        // ═══════════════════════════════════════════════════════════════════
        class Particle {
            constructor() {
                this.x  = (Math.random() - 0.5) * W  * 2.4;
                this.y  = (Math.random() - 0.5) * H  * 2.4;
                this.z  = (Math.random() - 0.5) * CFG.depth * 3.2;
                this.vx = (Math.random() - 0.5) * CFG.speed;
                this.vy = (Math.random() - 0.5) * CFG.speed;
                this.vz = (Math.random() - 0.5) * CFG.speed * 0.6;

                // Wander target
                this._newTarget();
                this.retarget = Math.random() * 180;

                this.baseSize = 1.6 + Math.random() * 2.4;
                this.phase    = Math.random() * Math.PI * 2;
                this.pulseSpd = 0.015 + Math.random() * 0.028;
            }

            _newTarget() {
                this.tx = (Math.random() - 0.5) * W  * 2.0;
                this.ty = (Math.random() - 0.5) * H  * 2.0;
                this.tz = (Math.random() - 0.5) * CFG.depth * 2.8;
                this.retarget = 130 + Math.random() * 220;
            }

            update() {
                // Wander
                if (--this.retarget <= 0) this._newTarget();
                this.vx += (this.tx - this.x) * 0.00007;
                this.vy += (this.ty - this.y) * 0.00007;
                this.vz += (this.tz - this.z) * 0.00005;

                // Turbulence
                this.vx += (Math.random() - 0.5) * CFG.turbulence;
                this.vy += (Math.random() - 0.5) * CFG.turbulence;
                this.vz += (Math.random() - 0.5) * CFG.turbulence * 0.5;

                // Mouse attraction
                if (mouse3D.active) {
                    const dx = mouse3D.x - this.x;
                    const dy = mouse3D.y - this.y;
                    const dz = mouse3D.z - this.z;
                    const d  = Math.sqrt(dx*dx + dy*dy + dz*dz);
                    if (d < CFG.mouseRadius && d > 1) {
                        const f = (1 - d / CFG.mouseRadius) * CFG.mouseStrength * 0.013;
                        this.vx += dx / d * f;
                        this.vy += dy / d * f;
                        this.vz += dz / d * f * 0.45;
                    }
                }

                // Drag
                this.vx *= CFG.drag;
                this.vy *= CFG.drag;
                this.vz *= CFG.drag;

                // Speed cap
                const spd = Math.sqrt(this.vx*this.vx + this.vy*this.vy + this.vz*this.vz);
                const max = CFG.speed * 3.5;
                if (spd > max) { const r = max/spd; this.vx*=r; this.vy*=r; this.vz*=r; }

                this.x += this.vx;
                this.y += this.vy;
                this.z += this.vz;
                this.phase += this.pulseSpd;

                // Wrap
                const bx = W*1.3, by = H*1.3, bz = CFG.depth*1.7;
                if (this.x >  bx) this.x = -bx;
                if (this.x < -bx) this.x =  bx;
                if (this.y >  by) this.y = -by;
                if (this.y < -by) this.y =  by;
                if (this.z >  bz) this.z = -bz;
                if (this.z < -bz) this.z =  bz;
            }

            project() {
                // Rotate Y-axis
                const cY = Math.cos(rotY), sY = Math.sin(rotY);
                let rx = this.x * cY - this.z * sY;
                let rz = this.x * sY + this.z * cY;

                // Rotate X-axis
                const cX = Math.cos(rotX), sX = Math.sin(rotX);
                let ry = this.y * cX - rz * sX;
                let fz = this.y * sX + rz * cX;
                let fx = rx, fy = ry;

                const fov = CFG.fov * zoom;
                const persp = fov + fz + CFG.depth;
                const scale = persp > 1 ? fov / persp : 0.001;

                return { sx: cx + fx*scale, sy: cy + fy*scale, scale, fz };
            }
        }

        // ═══════════════════════════════════════════════════════════════════
        //  PAIR ALPHA TABLE (smooth fade per connection)
        // ═══════════════════════════════════════════════════════════════════
        // Initialized dynamically in adjustConfig() now.


        // ═══════════════════════════════════════════════════════════════════
        //  HELPERS
        // ═══════════════════════════════════════════════════════════════════
        function lightFactor(sx, sy) {
            const nx = sx / W - 0.5;
            const ny = sy / H - 0.5;
            const dx = nx - CFG.light.x;
            const dy = ny - CFG.light.y;
            return Math.max(0.18, 1 - Math.sqrt(dx*dx + dy*dy) * 1.25);
        }

        function dist3D(a, b) {
            const dx=a.x-b.x, dy=a.y-b.y, dz=a.z-b.z;
            return Math.sqrt(dx*dx + dy*dy + dz*dz);
        }

        // ═══════════════════════════════════════════════════════════════════
        //  DRAW ORB
        // ═══════════════════════════════════════════════════════════════════
        function drawOrb(p, pj) {
            const lf    = lightFactor(pj.sx, pj.sy);
            const pulse = 0.72 + 0.28 * Math.sin(p.phase);
            const r     = pj.scale * p.baseSize * 2.4 * pulse;
            const alpha = Math.min(1, pj.scale * 2.1) * lf;
            if (alpha < 0.0000001 || r < 0.0000001) return; // Very permissive threshold for debugging

            // Halo - Conditionally draw for performance
            const haloAlpha = alpha * 0.4;
            if (haloAlpha > 0.01) {
                const halo = ctx.createRadialGradient(pj.sx, pj.sy, 0, pj.sx, pj.sy, r * 5.5);
                halo.addColorStop(0,   `rgba(102,252,241,${haloAlpha})`);
                halo.addColorStop(0.45,`rgba(69,162,158,${alpha * 0.12})`);
                halo.addColorStop(1,    'rgba(69,162,158,0)');
                ctx.beginPath();
                ctx.arc(pj.sx, pj.sy, r * 5.5, 0, Math.PI*2);
                ctx.fillStyle = halo;
                ctx.fill();
            }

            // Core with specular - Conditionally draw for performance
            const sx2 = pj.sx - r * 0.35, sy2 = pj.sy - r * 0.35;
            const coreAlpha = alpha;
            if (coreAlpha > 0.01) {
                const core = ctx.createRadialGradient(sx2, sy2, 0, pj.sx, pj.sy, r);
                core.addColorStop(0,   `rgba(235,255,255,${coreAlpha})`);
                core.addColorStop(0.35,`rgba(102,252,241,${coreAlpha})`);
                core.addColorStop(0.8, `rgba(69,162,158,${coreAlpha*0.85})`);
                core.addColorStop(1,   `rgba(11,12,16,${coreAlpha*0.35})`);
                ctx.beginPath();
                ctx.arc(pj.sx, pj.sy, r, 0, Math.PI*2);
                ctx.fillStyle = core;
                ctx.fill();
            }
        }

        // ═══════════════════════════════════════════════════════════════════
        //  DRAW CONNECTION
        // ═══════════════════════════════════════════════════════════════════
        function drawConnection(i, j, pjA, pjB, alpha) {
            if (alpha < 0.0000001) return; // Very permissive threshold for debugging

            const lfA  = lightFactor(pjA.sx, pjA.sy);
            const lfB  = lightFactor(pjB.sx, pjB.sy);
            const lf   = (lfA + lfB) * 0.5;
            const fa   = alpha * lf * 0.92;
            const lineW = Math.max(0.2, alpha * 2.2 * Math.min(pjA.scale, pjB.scale));

            // Optimized Line: Use solid color instead of gradient per line for performance
            ctx.beginPath();
            ctx.moveTo(pjA.sx, pjA.sy);
            ctx.lineTo(pjB.sx, pjB.sy);
            ctx.strokeStyle = `rgba(102, 252, 241, ${fa})`; // Solid CYAN with calculated alpha
            ctx.lineWidth   = lineW;
            ctx.lineCap     = 'round';
            ctx.stroke();

            // Traveling photons — two per line, opposite directions
            if (alpha > 0.18) {
                const speed = 0.008;
                for (let o = 0; o < 2; o++) {
                    const t  = ((frame * speed + o * 0.5) % 1);
                    const tx = pjA.sx + (pjB.sx - pjA.sx) * t;
                    const ty = pjA.sy + (pjB.sy - pjA.sy) * t;
                    const pa = alpha * Math.sin(t * Math.PI) * 0.85;

                    if (pa > 0.04) {
                        const pr = 4.5 * pa; // Use pa instead of alpha for photon radius
                        const sh = ctx.createRadialGradient(tx, ty, 0, tx, ty, pr);
                        sh.addColorStop(0,   `rgba(245,255,255,${pa})`);
                        sh.addColorStop(0.5, `rgba(102,252,241,${pa*0.5})`);
                        sh.addColorStop(1,   'rgba(102,252,241,0)');
                        ctx.beginPath();
                        ctx.arc(tx, ty, pr, 0, Math.PI*2);
                        ctx.fillStyle = sh;
                        ctx.fill();
                    }
                }
            }
        }

        // ═══════════════════════════════════════════════════════════════════
        //  MOUSE → 3D UNPROJECT
        // ═══════════════════════════════════════════════════════════════════
        function updateMouse3D() {
            const sx = mouseSCR.x - cx;
            const sy = mouseSCR.y - cy;

            // Unrotate (approximate, at z=0 world plane)
            const cY = Math.cos(-rotY), sY = Math.sin(-rotY);
            const cX = Math.cos(-rotX), sX = Math.sin(-rotX);

            // Unrotate X first
            const uy = sy * cX - 0 * sX;
            const uz = sy * sX + 0 * cX;

            // Unrotate Y
            const ux  = sx * cY - uz * sY;
            const uuz = sx * sY + uz * cY;

            mouse3D.x = ux;
            mouse3D.y = uy;
            mouse3D.z = uuz;
        }

        // ═══════════════════════════════════════════════════════════════════
        //  REPEL BURST
        // ═══════════════════════════════════════════════════════════════════
        function repelBurst() {
            particles.forEach(p => {
                const dx=p.x-mouse3D.x, dy=p.y-mouse3D.y, dz=p.z-mouse3D.z;
                const d = Math.sqrt(dx*dx+dy*dy+dz*dz);
                if (d < CFG.repelRadius && d > 1) {
                    const f = (1 - d/CFG.repelRadius) * CFG.repelStrength;
                    p.vx += dx/d*f; p.vy += dy/d*f; p.vz += dz/d*f*0.55;
                }
            });
        }

        // ═══════════════════════════════════════════════════════════════════
        //  CURSOR
        // ═══════════════════════════════════════════════════════════════════
        function drawCursor() {
            ctx.beginPath();
            ctx.arc(cursorPos.x, cursorPos.y, 10, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(102, 252, 241, 0.4)'; // Cyan, semi-transparent
            ctx.fill();

            ctx.beginPath();
            ctx.arc(cursorPos.x, cursorPos.y, 4, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(102, 252, 241, 0.9)'; // Brighter cyan
            ctx.fill();
        }

        // ═══════════════════════════════════════════════════════════════════
        //  EVENTS
        // ═══════════════════════════════════════════════════════════════════
        window.addEventListener('mousemove', e => {
            mouseSCR.x = e.clientX;  mouseSCR.y = e.clientY;
            cursorPos.x = e.clientX; cursorPos.y = e.clientY;
            mouse3D.active = true;
            lastMouseFrame = frame;
        });
        window.addEventListener('mouseleave', () => { mouse3D.active = false; });
        window.addEventListener('click', repelBurst);
        window.addEventListener('wheel', e => {
            zoom = Math.max(0.4, Math.min(2.2, zoom - e.deltaY * 0.0008));
        }, { passive: true });
        window.addEventListener('touchmove', e => {
            const t = e.touches[0];
            mouseSCR.x = t.clientX; mouseSCR.y = t.clientY;
            cursorPos.x = t.clientX; cursorPos.y = t.clientY;
            mouse3D.active = true; lastMouseFrame = frame;
        }, { passive: true });
        window.addEventListener('touchstart', e => {
            const t = e.touches[0];
            mouseSCR.x = t.clientX; mouseSCR.y = t.clientY;
            repelBurst();
        }, { passive: true });

        // ═══════════════════════════════════════════════════════════════════
        //  INIT
        // ═══════════════════════════════════════════════════════════════════
        // Particles initialized in adjustConfig() now.

        // ═══════════════════════════════════════════════════════════════════
        //  RENDER LOOP
        // ═══════════════════════════════════════════════════════════════════
        function draw() {
            frame++;

            // Rotation — auto drift vs mouse control
            const idle = frame - lastMouseFrame > 180;
            if (idle) {
                rotY += 0.00028;
                rotX += 0.00011;
            } else {
                const tX = 0.18 + (mouseSCR.y / H - 0.5) * 0.65;
                const tY = (mouseSCR.x / W - 0.5) * 1.3;
                rotX += (tX - rotX) * 0.014;
                rotY += (tY - rotY) * 0.014;
            }

            updateMouse3D();

            // ── BG ──
            ctx.fillStyle = '#0B0C10';
            ctx.fillRect(0, 0, W, H);

            // Vignette
            const vig = ctx.createRadialGradient(cx, cy, H*0.05, cx, cy, H*0.92);
            vig.addColorStop(0, 'rgba(0,0,0,0)');
            vig.addColorStop(1, 'rgba(0,0,0,0.68)');
            ctx.fillStyle = vig;
            ctx.fillRect(0, 0, W, H);

            // ── Update ──
            particles.forEach(p => p.update());

            // ── Project + sort (back→front) ──
            const PJ = particles.map(p => p.project());
            const order = particles.map((_,i)=>i).sort((a,b) => PJ[a].fz - PJ[b].fz);

            // ── Connections — TRUE 3D distance ──
            // Using requestAnimationFrame ensures only one context state is pushed/popped
            for (let ii = 0; ii < order.length - 1; ii++) {
                for (let jj = ii + 1; jj < order.length; jj++) {
                    const i = order[ii], j = order[jj];
                    const d = dist3D(particles[i], particles[j]);
                    const key = i * CFG.count + j; 

                    // Target alpha: quadratic proximity 0→1
                    const inRange = d < CFG.connectDist3D;
                    const target  = inRange ? Math.pow(1 - d / CFG.connectDist3D, 1.8) : 0;

                    // Smooth interpolation — fast connect, slow disconnect
                    const rate = target > pairAlpha[key] ? 0.10 : 0.038;
                    pairAlpha[key] += (target - pairAlpha[key]) * rate;

                    if (pairAlpha[key] > 0.003) {
                        drawConnection(i, j, PJ[i], PJ[j], pairAlpha[key]);
                    }
                }
            }
            // Moved ctx.save/restore out of inner loop, no need here.

            // ── Orbs ──
            order.forEach(i => drawOrb(particles[i], PJ[i]));

            // ── Mouse influence ring (now acts as custom cursor) ──
            if (mouse3D.active) {
                drawCursor(); // Draw custom cursor
                const ring = ctx.createRadialGradient(
                    cursorPos.x, cursorPos.y, 5,
                    cursorPos.x, cursorPos.y, 65
                );
                ring.addColorStop(0,   'rgba(102,252,241,0.0)');
                ring.addColorStop(0.75,'rgba(102,252,241,0.05)');
                ring.addColorStop(0.92,'rgba(102,252,241,0.10)');
                ring.addColorStop(1,   'rgba(102,252,241,0.0)');
                ctx.beginPath();
                ctx.arc(cursorPos.x, cursorPos.y, 65, 0, Math.PI*2);
                ctx.fillStyle = ring;
                ctx.fill();
            }

            requestAnimationFrame(draw);
        }

        draw();

    } // End if (canvas && ctx)

    // --- GSAP Animation for Title Fade Out ---
    if (document.querySelector('.title') && document.querySelector('.services-preview')) {
        gsap.to(".title", {
            opacity: 0,
            scrollTrigger: {
                trigger: ".services-preview",
                start: "top bottom",
                end: "top center",
                scrub: true,
                scroller: mainContentWrapper || undefined
            }
        });
    }

    // --- GSAP Reveal Animations for sections ---
    const revealSections = document.querySelectorAll('section:not(.hero-section)');

    revealSections.forEach((el) => {
        gsap.from(el, {
        opacity: 0,
        y: 80,
        scale: 0.98,
        duration: 1.2,
        ease: "expo.out",
        scrollTrigger: {
        trigger: el,
        start: "top 85%",
        toggleActions: "play none none none",
        scroller: mainContentWrapper || undefined
    }
});
    });

    // --- GSAP Reveal Animations for individual cards ---
    const cardSelectors = [
        '.service-card',
        '.portfolio-card',
        '.contact-card',
        '.step-card',
        '.price-card'
    ];

    cardSelectors.forEach(selector => {
        gsap.utils.toArray(selector).forEach(card => {
            gsap.from(card, {
    opacity: 0,
    y: selector === '.price-card' ? 80 : 50,
    scale: selector === '.price-card' ? 0.95 : 1,
    duration: selector === '.price-card' ? 1.2 : 0.8,
    ease: selector === '.price-card' ? "expo.out" : "power3.out",
    scrollTrigger: {
        trigger: card,
        start: "top 85%",
        toggleActions: "play none none none",
        scroller: mainContentWrapper || undefined
    }
});
        });
    });

    // --- Client-side Form Validation and Submission for book.html ---
    const bookingForm = document.getElementById('bookingForm');
    if (bookingForm) {
        // Remove any inline submit listener that may exist (book.html has a duplicate)
        const newForm = bookingForm.cloneNode(true);
        bookingForm.parentNode.replaceChild(newForm, bookingForm);

        newForm.addEventListener('submit', function(e) {
            e.preventDefault();
            let isValid = true;

            document.querySelectorAll('.error-message').forEach(err => err.remove());
            document.querySelectorAll('.is-invalid').forEach(el => el.classList.remove('is-invalid'));

            const formData = {
                service: newForm.querySelector('input[name="service"]:checked')?.value,
                name: newForm.querySelector('input[name="name"]').value.trim(),
                phone: newForm.querySelector('input[name="phone"]').value.trim(),
                email: newForm.querySelector('input[name="email"]').value.trim(),
                details: newForm.querySelector('textarea[name="details"]').value.trim(),
                deadline: newForm.querySelector('input[name="deadline"]').value,
                budget: newForm.querySelector('select[name="budget"]').value,
            };

            if (formData.name === '') {
                showError(newForm.querySelector('input[name="name"]'), 'Full Name is required.');
                isValid = false;
            }

            const phonePattern = /^\+?\d{10,15}$/;
            if (formData.phone === '') {
                showError(newForm.querySelector('input[name="phone"]'), 'Phone/WhatsApp is required.');
                isValid = false;
            } else if (!phonePattern.test(formData.phone.replace(/\s/g, ''))) {
                showError(newForm.querySelector('input[name="phone"]'), 'Please enter a valid phone number (10-15 digits).');
                isValid = false;
            }

            const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (formData.email !== '' && !emailPattern.test(formData.email)) {
                showError(newForm.querySelector('input[name="email"]'), 'Please enter a valid email address.');
                isValid = false;
            }

            if (formData.details.length < 20) {
                showError(newForm.querySelector('textarea[name="details"]'), 'Please provide more project details (min 20 characters).');
                isValid = false;
            }

            if (!formData.service) {
                const serviceSelectorDiv = newForm.querySelector('.service-selector');
                if (serviceSelectorDiv) showError(serviceSelectorDiv, 'Please select a service package.');
                isValid = false;
            }

            if (formData.deadline !== '') {
                const selectedDate = new Date(formData.deadline);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                if (selectedDate < today) {
                    showError(newForm.querySelector('input[name="deadline"]'), 'Deadline cannot be in the past.');
                    isValid = false;
                }
            }

            if (isValid) {
                const whatsappMessage = encodeURIComponent(
                    `New Booking Request:\nService: ${formData.service}\nName: ${formData.name}\nPhone: ${formData.phone}\nEmail: ${formData.email || 'N/A'}\nDetails: ${formData.details}\nDeadline: ${formData.deadline || 'N/A'}\nBudget: ${formData.budget || 'N/A'}`
                );
                window.open(`https://wa.me/918300920680?text=${whatsappMessage}`, '_blank');
                alert('🎉 Thank you! Your booking request has been sent to TN WEB RATS via WhatsApp. We will contact you within 24 hours.');
                newForm.reset();
            }
        });

        function showError(inputElement, message) {
            const parentForError = inputElement.closest('.service-selector') || inputElement.parentNode;
            inputElement.classList.add('is-invalid');
            let errorDiv = parentForError.querySelector('.error-message');
            if (!errorDiv) {
                errorDiv = document.createElement('div');
                errorDiv.classList.add('invalid-feedback', 'error-message');
                parentForError.appendChild(errorDiv);
            }
            errorDiv.textContent = message;
            errorDiv.style.display = 'block';
        }

        newForm.querySelectorAll('input, select, textarea').forEach(input => {
            input.addEventListener('input', () => {
                input.classList.remove('is-invalid');
                const parentForError = input.closest('.service-selector') || input.parentNode;
                const errorDiv = parentForError.querySelector('.error-message');
                if (errorDiv) errorDiv.style.display = 'none';
            });
        });
    }


    // --- WhatsApp floating button ---
    const whatsappBtn = document.createElement('a');
    whatsappBtn.href = 'https://wa.me/918300920680';
    whatsappBtn.className = 'whatsapp-float';
    whatsappBtn.target = '_blank';
    whatsappBtn.innerHTML = '<i class="fab fa-whatsapp"></i>';
    document.body.appendChild(whatsappBtn);
});

// Magnetic hover effect
document.querySelectorAll('.btn, .service-card, .portfolio-card').forEach(el => {
    el.addEventListener('mousemove', e => {
        const rect = el.getBoundingClientRect();
        const x = e.clientX - rect.left - rect.width / 2;
        const y = e.clientY - rect.top - rect.height / 2;
        el.style.transform = `translate(${x * 0.05}px, ${y * 0.05}px)`;
    });

    el.addEventListener('mouseleave', () => {
        el.style.transform = 'translate(0,0)';
    });
});