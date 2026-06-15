use std::path::PathBuf;
use std::fs;
use crate::wallpaper::providers::VideoResult;

const NEON_WAVES_HTML: &str = r#"
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <style>body, html { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background: #050510; } canvas { display: block; }</style>
</head>
<body>
    <canvas id="c"></canvas>
    <script>
        const c = document.getElementById('c');
        const ctx = c.getContext('2d');
        let w = c.width = window.innerWidth;
        let h = c.height = window.innerHeight;
        let mouseX = w/2, mouseY = h/2;
        document.addEventListener('mousemove', e => { mouseX = e.clientX; mouseY = e.clientY; });
        
        let audioBins = [];
        window.__dispatch_audio = (bins) => {
            audioBins = bins;
        };

        let t = 0;
        function draw() {
            ctx.fillStyle = 'rgba(5, 5, 16, 0.1)';
            ctx.fillRect(0, 0, w, h);
            
            let bass = 0, mid = 0, high = 0;
            if (audioBins.length >= 64) {
                for(let i=0; i<6; i++) bass += audioBins[i];
                for(let i=6; i<20; i++) mid += audioBins[i];
                for(let i=20; i<64; i++) high += audioBins[i];
                bass /= 6; mid /= 14; high /= 44;
            }

            for(let i = 0; i < 3; i++) {
                ctx.beginPath();
                for(let x = 0; x <= w; x += 5) {
                    let audioReact = 0;
                    if (i === 0) audioReact = bass * 1500;
                    else if (i === 1) audioReact = mid * 2000;
                    else audioReact = high * 3000;
                    
                    let y = h/2 + Math.sin(x*0.01 + t + i) * (50 + audioReact) + Math.sin(x*0.02 - t) * ((mouseY/h)*100);
                    ctx.lineTo(x, y);
                }
                ctx.strokeStyle = `hsl(${t*50 + i*120}, 100%, 50%)`;
                ctx.lineWidth = 3 + (bass * 50);
                ctx.stroke();
            }
            t += 0.05 + (bass * 0.5);
            requestAnimationFrame(draw);
        }
        window.addEventListener('resize', () => { w = c.width = window.innerWidth; h = c.height = window.innerHeight; });
        draw();
    </script>
</body>
</html>
"#;

const CURSOR_TRAIL_HTML: &str = r#"
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <style>body, html { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background: #000; } canvas { display: block; }</style>
</head>
<body>
    <canvas id="c"></canvas>
    <script>
        const c = document.getElementById('c');
        const ctx = c.getContext('2d');
        let w = c.width = window.innerWidth;
        let h = c.height = window.innerHeight;
        let particles = [];
        document.addEventListener('mousemove', e => {
            for(let i=0; i<5; i++) {
                particles.push({x: e.clientX, y: e.clientY, vx: (Math.random()-0.5)*5, vy: (Math.random()-0.5)*5, life: 1});
            }
        });
        function draw() {
            ctx.fillStyle = 'rgba(0,0,0,0.2)';
            ctx.fillRect(0,0,w,h);
            ctx.globalCompositeOperation = 'lighter';
            particles.forEach((p, i) => {
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.life * 10, 0, Math.PI*2);
                ctx.fillStyle = `rgba(255, ${p.life*150}, 0, ${p.life})`;
                ctx.fill();
                p.x += p.vx; p.y += p.vy; p.life -= 0.02;
                if(p.life <= 0) particles.splice(i, 1);
            });
            ctx.globalCompositeOperation = 'source-over';
            requestAnimationFrame(draw);
        }
        window.addEventListener('resize', () => { w = c.width = window.innerWidth; h = c.height = window.innerHeight; });
        draw();
    </script>
</body>
</html>
"#;

const HEXAGON_GRID_HTML: &str = r#"
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <style>body, html { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background: #111; } canvas { display: block; }</style>
</head>
<body>
    <canvas id="c"></canvas>
    <script>
        const c = document.getElementById('c');
        const ctx = c.getContext('2d');
        let w = c.width = window.innerWidth;
        let h = c.height = window.innerHeight;
        let mouseX = -1000, mouseY = -1000;
        document.addEventListener('mousemove', e => { mouseX = e.clientX; mouseY = e.clientY; });
        const hexSize = 30;
        const hexW = Math.sqrt(3) * hexSize;
        const hexH = 2 * hexSize;
        function drawHex(x, y, r, alpha) {
            ctx.beginPath();
            for(let i=0; i<6; i++) {
                let angle = Math.PI / 3 * i - Math.PI / 6;
                ctx.lineTo(x + r * Math.cos(angle), y + r * Math.sin(angle));
            }
            ctx.closePath();
            ctx.strokeStyle = `rgba(0, 255, 255, ${alpha})`;
            ctx.stroke();
        }
        function draw() {
            ctx.clearRect(0,0,w,h);
            for(let y=0; y<h+hexH; y+=hexH*0.75) {
                for(let x=0; x<w+hexW; x+=hexW) {
                    let cx = x + ((y/(hexH*0.75))%2===0 ? 0 : hexW/2);
                    let cy = y;
                    let dx = cx - mouseX;
                    let dy = cy - mouseY;
                    let dist = Math.sqrt(dx*dx + dy*dy);
                    let alpha = Math.max(0.1, 1 - dist/200);
                    drawHex(cx, cy, hexSize*0.9, alpha);
                }
            }
            requestAnimationFrame(draw);
        }
        window.addEventListener('resize', () => { w = c.width = window.innerWidth; h = c.height = window.innerHeight; });
        draw();
    </script>
</body>
</html>
"#;

const STARFIELD_HTML: &str = r#"
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <style>body, html { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background: #000; } canvas { display: block; }</style>
</head>
<body>
    <canvas id="c"></canvas>
    <script>
        const c = document.getElementById('c');
        const ctx = c.getContext('2d');
        let w = c.width = window.innerWidth;
        let h = c.height = window.innerHeight;
        let mouseX = w/2, mouseY = h/2;
        document.addEventListener('mousemove', e => { mouseX = e.clientX; mouseY = e.clientY; });
        let stars = Array(500).fill().map(() => [Math.random()*w*2-w, Math.random()*h*2-h, Math.random()*w]);
        function draw() {
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.fillRect(0,0,w,h);
            let cx = w/2 + (mouseX - w/2)*0.1;
            let cy = h/2 + (mouseY - h/2)*0.1;
            stars.forEach(s => {
                s[2] -= 5;
                if(s[2] <= 0) { s[0] = Math.random()*w*2-w; s[1] = Math.random()*h*2-h; s[2] = w; }
                let sx = s[0]/s[2]*w + cx;
                let sy = s[1]/s[2]*w + cy;
                let size = (1 - s[2]/w) * 3;
                ctx.fillStyle = '#fff';
                ctx.beginPath();
                ctx.arc(sx, sy, size, 0, Math.PI*2);
                ctx.fill();
            });
            requestAnimationFrame(draw);
        }
        window.addEventListener('resize', () => { w = c.width = window.innerWidth; h = c.height = window.innerHeight; });
        draw();
    </script>
</body>
</html>
"#;

const PARTICLE_VORTEX_HTML: &str = r#"
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <style>body, html { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background: #050011; } canvas { display: block; }</style>
</head>
<body>
    <canvas id="c"></canvas>
    <script>
        const c = document.getElementById('c');
        const ctx = c.getContext('2d');
        let w = c.width = window.innerWidth;
        let h = c.height = window.innerHeight;
        let mouseX = w/2, mouseY = h/2;
        document.addEventListener('mousemove', e => { mouseX = e.clientX; mouseY = e.clientY; });
        let p = Array(300).fill().map(() => ({a: Math.random()*Math.PI*2, r: Math.random()*500+50, s: Math.random()*0.02+0.01}));
        function draw() {
            ctx.fillStyle = 'rgba(5,0,17,0.1)';
            ctx.fillRect(0,0,w,h);
            p.forEach(i => {
                i.a += i.s;
                i.r -= 1;
                if(i.r < 0) { i.r = 500; i.a = Math.random()*Math.PI*2; }
                let x = mouseX + Math.cos(i.a)*i.r;
                let y = mouseY + Math.sin(i.a)*i.r;
                ctx.fillStyle = `hsl(${i.r}, 100%, 50%)`;
                ctx.beginPath();
                ctx.arc(x, y, 2, 0, Math.PI*2);
                ctx.fill();
            });
            requestAnimationFrame(draw);
        }
        window.addEventListener('resize', () => { w = c.width = window.innerWidth; h = c.height = window.innerHeight; });
        draw();
    </script>
</body>
</html>
"#;

const BOIDS_FLOCK_HTML: &str = r#"
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <style>body, html { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background: #001122; } canvas { display: block; }</style>
</head>
<body>
    <canvas id="c"></canvas>
    <script>
        const c = document.getElementById('c');
        const ctx = c.getContext('2d');
        let w = c.width = window.innerWidth;
        let h = c.height = window.innerHeight;
        let mouseX = w/2, mouseY = h/2;
        document.addEventListener('mousemove', e => { mouseX = e.clientX; mouseY = e.clientY; });
        let boids = Array(100).fill().map(() => ({x: Math.random()*w, y: Math.random()*h, vx: Math.random()*4-2, vy: Math.random()*4-2}));
        function draw() {
            ctx.fillStyle = 'rgba(0,17,34,0.3)';
            ctx.fillRect(0,0,w,h);
            boids.forEach(b => {
                let dx = mouseX - b.x; let dy = mouseY - b.y;
                let dist = Math.sqrt(dx*dx + dy*dy);
                if(dist < 300) { b.vx += dx*0.001; b.vy += dy*0.001; }
                let speed = Math.sqrt(b.vx*b.vx + b.vy*b.vy);
                if(speed > 5) { b.vx = (b.vx/speed)*5; b.vy = (b.vy/speed)*5; }
                b.x += b.vx; b.y += b.vy;
                if(b.x<0) b.x=w; if(b.x>w) b.x=0;
                if(b.y<0) b.y=h; if(b.y>h) b.y=0;
                ctx.fillStyle = '#0ff';
                ctx.beginPath();
                ctx.arc(b.x, b.y, 3, 0, Math.PI*2);
                ctx.fill();
            });
            requestAnimationFrame(draw);
        }
        window.addEventListener('resize', () => { w = c.width = window.innerWidth; h = c.height = window.innerHeight; });
        draw();
    </script>
</body>
</html>
"#;

const BUBBLE_POP_HTML: &str = r#"
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <style>body, html { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background: #002233; } canvas { display: block; }</style>
</head>
<body>
    <canvas id="c"></canvas>
    <script>
        const c = document.getElementById('c');
        const ctx = c.getContext('2d');
        let w = c.width = window.innerWidth;
        let h = c.height = window.innerHeight;
        let bubbles = Array(50).fill().map(() => ({x: Math.random()*w, y: Math.random()*h, r: Math.random()*30+10, vy: -Math.random()*2-1}));
        document.addEventListener('mousemove', e => {
            bubbles.forEach(b => {
                let dx = e.clientX - b.x; let dy = e.clientY - b.y;
                if(Math.sqrt(dx*dx + dy*dy) < b.r) { b.y = h + b.r; b.x = Math.random()*w; } // pop!
            });
        });
        function draw() {
            ctx.clearRect(0,0,w,h);
            bubbles.forEach(b => {
                b.y += b.vy;
                if(b.y < -b.r) { b.y = h + b.r; b.x = Math.random()*w; }
                ctx.strokeStyle = 'rgba(0, 200, 255, 0.5)';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(b.x, b.y, b.r, 0, Math.PI*2);
                ctx.stroke();
            });
            requestAnimationFrame(draw);
        }
        window.addEventListener('resize', () => { w = c.width = window.innerWidth; h = c.height = window.innerHeight; });
        draw();
    </script>
</body>
</html>
"#;

const GRAVITY_POINTS_HTML: &str = r#"
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <style>body, html { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background: #1a1a1a; } canvas { display: block; }</style>
</head>
<body>
    <canvas id="c"></canvas>
    <script>
        const c = document.getElementById('c');
        const ctx = c.getContext('2d');
        let w = c.width = window.innerWidth;
        let h = c.height = window.innerHeight;
        let mouseX = w/2, mouseY = h/2, md = false;
        document.addEventListener('mousemove', e => { mouseX = e.clientX; mouseY = e.clientY; });
        document.addEventListener('mousedown', () => md = true);
        document.addEventListener('mouseup', () => md = false);
        let p = Array(200).fill().map(() => ({x: Math.random()*w, y: Math.random()*h, vx: 0, vy: 0}));
        function draw() {
            ctx.fillStyle = 'rgba(26,26,26,0.2)';
            ctx.fillRect(0,0,w,h);
            p.forEach(i => {
                let dx = mouseX - i.x; let dy = mouseY - i.y;
                let dist = Math.sqrt(dx*dx + dy*dy);
                if(dist < 400) {
                    let f = md ? 0.05 : -0.01;
                    i.vx += dx * f; i.vy += dy * f;
                }
                i.vx *= 0.95; i.vy *= 0.95;
                i.x += i.vx; i.y += i.vy;
                if(i.x<0||i.x>w) i.vx *= -1;
                if(i.y<0||i.y>h) i.vy *= -1;
                ctx.fillStyle = '#ff0055';
                ctx.beginPath(); ctx.arc(i.x, i.y, 2, 0, Math.PI*2); ctx.fill();
            });
            requestAnimationFrame(draw);
        }
        window.addEventListener('resize', () => { w = c.width = window.innerWidth; h = c.height = window.innerHeight; });
        draw();
    </script>
</body>
</html>
"#;

const INTERACTIVE_RIPPLE_HTML: &str = r#"
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <style>body, html { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background: #020202; } canvas { display: block; }</style>
</head>
<body>
    <canvas id="c"></canvas>
    <script>
        const c = document.getElementById('c');
        const ctx = c.getContext('2d');
        let w = c.width = window.innerWidth;
        let h = c.height = window.innerHeight;
        let ripples = [];
        document.addEventListener('mousemove', e => {
            if(Math.random() > 0.5) ripples.push({x: e.clientX, y: e.clientY, r: 0, alpha: 1});
        });
        function draw() {
            ctx.fillStyle = 'rgba(2,2,2,0.1)';
            ctx.fillRect(0,0,w,h);
            ripples.forEach((r, i) => {
                ctx.strokeStyle = `rgba(0, 150, 255, ${r.alpha})`;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(r.x, r.y, r.r, 0, Math.PI*2);
                ctx.stroke();
                r.r += 3; r.alpha -= 0.02;
                if(r.alpha <= 0) ripples.splice(i, 1);
            });
            requestAnimationFrame(draw);
        }
        window.addEventListener('resize', () => { w = c.width = window.innerWidth; h = c.height = window.innerHeight; });
        draw();
    </script>
</body>
</html>
"#;

const BOUNCING_DVD_HTML: &str = r#"
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <style>body, html { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background: #000; font-family: sans-serif; font-weight: bold; } canvas { display: block; }</style>
</head>
<body>
    <canvas id="c"></canvas>
    <script>
        const c = document.getElementById('c');
        const ctx = c.getContext('2d');
        let w = c.width = window.innerWidth;
        let h = c.height = window.innerHeight;
        let dvd = {x: w/2, y: h/2, vx: 3, vy: 3, w: 150, h: 60, col: '#ff0000'};
        const colors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#00ffff', '#ff00ff'];
        document.addEventListener('click', e => {
            dvd.x = e.clientX - dvd.w/2; dvd.y = e.clientY - dvd.h/2;
            dvd.col = colors[Math.floor(Math.random()*colors.length)];
        });
        function draw() {
            ctx.clearRect(0,0,w,h);
            dvd.x += dvd.vx; dvd.y += dvd.vy;
            if(dvd.x < 0 || dvd.x + dvd.w > w) { dvd.vx *= -1; dvd.col = colors[Math.floor(Math.random()*colors.length)]; }
            if(dvd.y < 0 || dvd.y + dvd.h > h) { dvd.vy *= -1; dvd.col = colors[Math.floor(Math.random()*colors.length)]; }
            ctx.fillStyle = dvd.col;
            ctx.fillRect(dvd.x, dvd.y, dvd.w, dvd.h);
            ctx.fillStyle = '#fff';
            ctx.font = '30px sans-serif';
            ctx.fillText('DVD', dvd.x + 40, dvd.y + 40);
            requestAnimationFrame(draw);
        }
        window.addEventListener('resize', () => { w = c.width = window.innerWidth; h = c.height = window.innerHeight; });
        draw();
    </script>
</body>
</html>
"#;

const ICON_PHYSICS_HTML: &str = r#"
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <style>body, html { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background: #000; } canvas { display: block; }</style>
</head>
<body>
    <canvas id="c"></canvas>
    <script>
        const c = document.getElementById('c');
        const ctx = c.getContext('2d');
        let w = c.width = window.innerWidth;
        let h = c.height = window.innerHeight;
        let icons = [];

        window.__dispatch_icons = (data) => {
            icons = data;
        };

        class Particle {
            constructor() {
                this.reset();
            }
            reset() {
                this.x = Math.random() * w;
                this.y = Math.random() * -100 - 10;
                this.vx = (Math.random() - 0.5) * 2;
                this.vy = Math.random() * 2 + 1;
                this.radius = Math.random() * 2 + 1;
                this.color = `hsl(${Math.random() * 60 + 180}, 100%, 70%)`;
                this.restitution = 0.5;
            }
            update() {
                this.vy += 0.2; // Gravity
                
                // Max fall speed
                if (this.vy > 12) this.vy = 12;
                
                this.x += this.vx;
                this.y += this.vy;
                
                // Air friction
                this.vx *= 0.99;

                for (let icon of icons) {
                    // Tighter hitbox to match the actual icon graphic rather than the grid cell
                    let hitX = icon.x + 15;
                    let hitY = icon.y + 10;
                    let hitW = icon.w - 30;
                    let hitH = icon.h - 30;

                    if (this.x > hitX && this.x < hitX + hitW &&
                        this.y + this.radius > hitY && this.y - this.radius < hitY + hitH) {
                        
                        let prevY = this.y - this.vy;
                        if (prevY + this.radius <= hitY) {
                            this.y = hitY - this.radius;
                            this.vy *= -this.restitution;
                            
                            // Splash sideways so particles roll off the icons
                            this.vx += (Math.random() - 0.5) * 5;
                            
                            // If a particle has lost most of its vertical momentum, it's stuck on the icon. Reset it!
                            if (Math.abs(this.vy) < 1.5) {
                                this.reset();
                            }
                        } else if (this.y - this.radius >= hitY + hitH) {
                            this.y = hitY + hitH + this.radius;
                            this.vy *= -this.restitution;
                        } else {
                            this.vx *= -this.restitution;
                        }
                    }
                }

                if (this.y > h + 10 || this.x < -10 || this.x > w + 10) {
                    this.reset();
                }
            }
            draw() {
                ctx.fillStyle = this.color;
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        const particles = Array.from({ length: 1500 }, () => new Particle());

        function loop() {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
            ctx.fillRect(0, 0, w, h);

            for (let p of particles) {
                p.update();
                p.draw();
            }
            requestAnimationFrame(loop);
        }
        loop();

        window.addEventListener('resize', () => { w = c.width = window.innerWidth; h = c.height = window.innerHeight; });
    </script>
</body>
</html>
"#;

const MATRIX_RAIN_PHYSICS_HTML: &str = r#"
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <style>body, html { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background: #000; } canvas { display: block; }</style>
</head>
<body>
    <canvas id="c"></canvas>
    <script>
        const c = document.getElementById('c');
        const ctx = c.getContext('2d');
        let w = c.width = window.innerWidth;
        let h = c.height = window.innerHeight;
        let icons = []; window.__dispatch_icons = (data) => icons = data;
        
        let hue = 120; // Default green
        document.addEventListener('click', () => { hue = (hue + 60) % 360; });

        class Rain {
            constructor() { this.reset(); this.y = Math.random() * h; }
            reset() {
                this.x = Math.random() * w;
                this.y = Math.random() * -100 - 10;
                this.vy = Math.random() * 2 + 2;
                this.char = String.fromCharCode(0x30A0 + Math.random() * 96);
                this.state = 'falling';
            }
            update() {
                if (this.state === 'falling') {
                    this.y += this.vy;
                    for (let icon of icons) {
                        let hitX = icon.x + 15, hitY = icon.y + 5, hitW = icon.w - 30, hitH = icon.w - 30;
                        if (this.x > hitX && this.x < hitX + hitW && this.y > hitY && this.y < hitY + 10) {
                            this.state = 'splashing';
                            this.y = hitY;
                            this.targetIcon = {x: hitX, y: hitY, w: hitW, h: hitH};
                            this.vx = (this.x > hitX + hitW/2) ? 2 : -2;
                            break;
                        }
                    }
                } else if (this.state === 'splashing') {
                    this.x += this.vx;
                    if (this.x < this.targetIcon.x || this.x > this.targetIcon.x + this.targetIcon.w) {
                        this.state = 'sliding';
                        this.slideSpeed = Math.random() * 0.5 + 0.5;
                    }
                } else if (this.state === 'sliding') {
                    this.y += this.slideSpeed;
                    if (this.y >= this.targetIcon.y + this.targetIcon.h) {
                        this.state = 'dripping';
                        this.slideTimer = Math.floor(Math.random() * 60) + 30;
                        this.vy = 0;
                    }
                } else if (this.state === 'dripping') {
                    if (this.slideTimer > 0) this.slideTimer--;
                    else {
                        this.vy += 0.2;
                        this.y += this.vy;
                    }
                }
                if (this.y > h) this.reset();
                if(Math.random() > 0.9) this.char = String.fromCharCode(0x30A0 + Math.random() * 96);
            }
            draw() {
                ctx.fillStyle = this.state === 'splashing' ? '#FFF' : `hsl(${hue}, 100%, 50%)`;
                ctx.font = '14px monospace';
                let drawX = this.state === 'falling' ? Math.floor(this.x / 14) * 14 : this.x;
                ctx.fillText(this.char, drawX, this.y);
            }
        }
        const drops = Array.from({length: 400}, () => new Rain());
        function loop() {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
            ctx.fillRect(0, 0, w, h);
            for (let d of drops) { d.update(); d.draw(); }
            requestAnimationFrame(loop);
        }
        loop();
        window.addEventListener('resize', () => { w = c.width = window.innerWidth; h = c.height = window.innerHeight; });
    </script>
</body>
</html>
"#;

const SNOW_PHYSICS_HTML: &str = r#"
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <style>body, html { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background: #000510; } canvas { display: block; }</style>
</head>
<body>
    <canvas id="c"></canvas>
    <script>
        const c = document.getElementById('c');
        const ctx = c.getContext('2d');
        let w = c.width = window.innerWidth, h = c.height = window.innerHeight;
        let icons = []; window.__dispatch_icons = (data) => icons = data;
        let wind = 0;
        
        let hue = 210; // Default icy blue
        document.addEventListener('click', () => { hue = (hue + 50) % 360; });

        class Snow {
            constructor() { this.reset(); this.y = Math.random() * h; }
            reset() {
                this.x = Math.random() * w;
                this.y = Math.random() * -100;
                this.vy = Math.random() * 1 + 0.5;
                this.r = Math.random() * 2 + 1;
                this.vx = 0;
                this.state = 'falling';
            }
            update() {
                if (this.state === 'falling') {
                    this.x += this.vx + wind;
                    this.y += this.vy;
                    this.vx = Math.sin(this.y * 0.01) * 0.5;
                    for (let icon of icons) {
                        let hitX = icon.x + 15, hitY = icon.y + 5, hitW = icon.w - 30, hitH = icon.w - 30;
                        if (this.x > hitX && this.x < hitX + hitW && this.y > hitY && this.y < hitY + 10) {
                            this.state = 'stuck';
                            this.stuckTimer = Math.floor(Math.random() * 150) + 50;
                            this.y = hitY;
                            this.targetIcon = {x: hitX, y: hitY, w: hitW, h: hitH};
                            break;
                        }
                    }
                } else if (this.state === 'stuck') {
                    this.stuckTimer--;
                    if (this.stuckTimer <= 0) {
                        this.state = 'sliding';
                        this.slideVx = (Math.random() > 0.5 ? 0.5 : -0.5);
                    }
                } else if (this.state === 'sliding') {
                    this.x += this.slideVx;
                    this.y += 0.5; // Melt down the side
                    if (this.y >= this.targetIcon.y + this.targetIcon.h || this.x < this.targetIcon.x || this.x > this.targetIcon.x + this.targetIcon.w) {
                        this.state = 'falling';
                        this.vy = Math.random() * 1 + 0.5;
                    }
                }
                
                if (this.y > h || this.x < 0 || this.x > w) this.reset();
            }
            draw() {
                ctx.fillStyle = `hsla(${hue}, 80%, 80%, ${this.state !== 'falling' ? 0.3 : 0.8})`;
                ctx.beginPath(); ctx.arc(this.x, this.y, this.r, 0, Math.PI*2); ctx.fill();
            }
        }
        const flakes = Array.from({length: 800}, () => new Snow());
        function loop() {
            wind = Math.sin(Date.now() * 0.001) * 0.5;
            ctx.clearRect(0, 0, w, h);
            for (let f of flakes) { f.update(); f.draw(); }
            requestAnimationFrame(loop);
        }
        loop();
        window.addEventListener('resize', () => { w = c.width = window.innerWidth; h = c.height = window.innerHeight; });
    </script>
</body>
</html>
"#;

const FLUID_DROPS_HTML: &str = r#"
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <style>body, html { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background: #000; } canvas { display: block; }</style>
</head>
<body>
    <canvas id="c"></canvas>
    <script>
        const c = document.getElementById('c');
        const ctx = c.getContext('2d');
        let w = c.width = window.innerWidth, h = c.height = window.innerHeight;
        let icons = []; window.__dispatch_icons = (data) => icons = data;
        let ripples = [];
        
        let hue = 200; // Cyan water
        document.addEventListener('click', () => { hue = (hue + 45) % 360; });

        class Drop {
            constructor() { this.reset(); this.y = Math.random() * h; }
            reset() {
                this.x = Math.random() * w; this.y = Math.random() * -100;
                this.vy = Math.random() * 4 + 4;
                this.state = 'falling';
            }
            update() {
                if (this.state === 'falling') {
                    this.y += this.vy;
                    for (let icon of icons) {
                        let hitX = icon.x + 15, hitY = icon.y + 5, hitW = icon.w - 30, hitH = icon.w - 30;
                        if (this.x > hitX && this.x < hitX+hitW && this.y > hitY && this.y < hitY+10) {
                            ripples.push({x: this.x, y: hitY, r: 0, alpha: 1});
                            this.state = 'sliding';
                            this.y = hitY;
                            this.targetIcon = {x: hitX, y: hitY, w: hitW, h: hitH};
                            this.vx = (this.x > hitX + hitW/2) ? 1.5 : -1.5;
                            return;
                        }
                    }
                } else if (this.state === 'sliding') {
                    this.x += this.vx;
                    if (this.x < this.targetIcon.x || this.x > this.targetIcon.x + this.targetIcon.w) {
                        this.state = 'dripping_down';
                        this.slideSpeed = Math.random() * 1.5 + 1;
                    }
                } else if (this.state === 'dripping_down') {
                    this.y += this.slideSpeed;
                    if (this.y >= this.targetIcon.y + this.targetIcon.h) {
                        this.state = 'hanging';
                        this.hangTimer = Math.floor(Math.random() * 40) + 20;
                        this.vy = 0;
                    }
                } else if (this.state === 'hanging') {
                    this.hangTimer--;
                    if (this.hangTimer <= 0) {
                        this.vy += 0.3;
                        this.y += this.vy;
                    }
                }
                if (this.y > h) this.reset();
            }
            draw() {
                ctx.fillStyle = `hsl(${hue}, 100%, 60%)`;
                if (this.state === 'hanging') {
                    ctx.beginPath(); ctx.arc(this.x, this.y, 2 + (40-this.hangTimer)/20, 0, Math.PI*2); ctx.fill();
                } else {
                    ctx.fillRect(this.x, this.y, 2, this.state === 'falling' ? 10 : 4);
                }
            }
        }
        const drops = Array.from({length: 150}, () => new Drop());
        function loop() {
            ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(0, 0, w, h);
            for (let d of drops) { d.update(); d.draw(); }
            for (let i = ripples.length-1; i >= 0; i--) {
                let r = ripples[i];
                ctx.strokeStyle = `hsla(${hue}, 100%, 60%, ${r.alpha})`; ctx.lineWidth = 1.5;
                ctx.beginPath(); ctx.ellipse(r.x, r.y, r.r, r.r/2, 0, 0, Math.PI*2); ctx.stroke();
                r.r += 2; r.alpha -= 0.02;
                if (r.alpha <= 0) ripples.splice(i, 1);
            }
            requestAnimationFrame(loop);
        }
        loop();
        window.addEventListener('resize', () => { w = c.width = window.innerWidth; h = c.height = window.innerHeight; });
    </script>
</body>
</html>
"#;

const LASER_REFLECTIONS_HTML: &str = r#"
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <style>body, html { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background: #000; } canvas { display: block; }</style>
</head>
<body>
    <canvas id="c"></canvas>
    <script>
        const c = document.getElementById('c');
        const ctx = c.getContext('2d');
        let w = c.width = window.innerWidth, h = c.height = window.innerHeight;
        let icons = []; window.__dispatch_icons = (data) => icons = data;
        
        let hueOffset = 0;
        document.addEventListener('click', () => { hueOffset += 90; });

        class Laser {
            constructor() { this.reset(); }
            reset() {
                this.x = Math.random() > 0.5 ? 0 : w;
                this.y = Math.random() * h;
                this.vx = (this.x === 0 ? 1 : -1) * (Math.random()*3+3);
                this.vy = (Math.random()-0.5) * 6;
                this.baseHue = Math.random() * 360;
                this.history = [];
            }
            update() {
                this.history.push({x: this.x, y: this.y});
                if (this.history.length > 20) this.history.shift();
                
                this.x += this.vx; this.y += this.vy;
                
                for (let icon of icons) {
                    let hitX = icon.x + 10, hitY = icon.y + 10, hitW = icon.w - 20, hitH = icon.h - 20;
                    if (this.x > hitX && this.x < hitX+hitW && this.y > hitY && this.y < hitY+hitH) {
                        // Reflect!
                        let dx1 = Math.abs(this.x - hitX); let dx2 = Math.abs(this.x - (hitX+hitW));
                        let dy1 = Math.abs(this.y - hitY); let dy2 = Math.abs(this.y - (hitY+hitH));
                        let min = Math.min(dx1, dx2, dy1, dy2);
                        if (min === dx1 || min === dx2) this.vx *= -1;
                        if (min === dy1 || min === dy2) this.vy *= -1;
                        this.x += this.vx; this.y += this.vy; // Push out
                    }
                }
                if (this.x < 0 || this.x > w || this.y < 0 || this.y > h) this.reset();
            }
            draw() {
                ctx.beginPath();
                if (this.history.length > 0) {
                    ctx.moveTo(this.history[0].x, this.history[0].y);
                    for (let i=1; i<this.history.length; i++) ctx.lineTo(this.history[i].x, this.history[i].y);
                }
                ctx.lineTo(this.x, this.y);
                let col = `hsl(${(this.baseHue + hueOffset) % 360}, 100%, 60%)`;
                ctx.strokeStyle = col; ctx.lineWidth = 3;
                ctx.shadowBlur = 10; ctx.shadowColor = col;
                ctx.stroke(); ctx.shadowBlur = 0;
            }
        }
        const lasers = Array.from({length: 15}, () => new Laser());
        function loop() {
            ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fillRect(0, 0, w, h);
            for (let l of lasers) { l.update(); l.draw(); }
            requestAnimationFrame(loop);
        }
        loop();
        window.addEventListener('resize', () => { w = c.width = window.innerWidth; h = c.height = window.innerHeight; });
    </script>
</body>
</html>
"#;

const MAGNETIC_SWARM_HTML: &str = r#"
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <style>body, html { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background: #050505; } canvas { display: block; }</style>
</head>
<body>
    <canvas id="c"></canvas>
    <script>
        const c = document.getElementById('c');
        const ctx = c.getContext('2d');
        let w = c.width = window.innerWidth, h = c.height = window.innerHeight;
        let icons = []; window.__dispatch_icons = (data) => icons = data;
        let mx = w/2, my = h/2; document.addEventListener('mousemove', e => { mx = e.clientX; my = e.clientY; });
        
        let hue = 320; // Cyber pink
        document.addEventListener('click', () => { hue = (hue + 75) % 360; });

        class Mote {
            constructor() {
                this.x = Math.random()*w; this.y = Math.random()*h;
                this.vx = 0; this.vy = 0;
            }
            update() {
                let dx = mx - this.x, dy = my - this.y;
                let dist = Math.sqrt(dx*dx + dy*dy);
                
                this.vx += (Math.random() - 0.5) * 1.5;
                this.vy += (Math.random() - 0.5) * 1.5;

                if (dist > 60) { 
                    this.vx += (dx/dist)*0.5; 
                    this.vy += (dy/dist)*0.5; 
                } else {
                    this.vx += -dy * 0.02;
                    this.vy += dx * 0.02;
                }
                
                for (let icon of icons) {
                    let cx = icon.x + icon.w/2, cy = icon.y + icon.h/2;
                    let idx = this.x - cx, idy = this.y - cy;
                    let idist = Math.sqrt(idx*idx + idy*idy);
                    if (idist < 80) {
                        this.vx += (idx/idist)*3; this.vy += (idy/idist)*3;
                    }
                }
                
                this.vx *= 0.92; this.vy *= 0.92;
                this.x += this.vx; this.y += this.vy;
            }
            draw() {
                ctx.fillStyle = `hsl(${hue}, 100%, 60%)`; 
                ctx.beginPath(); ctx.arc(this.x, this.y, 2, 0, Math.PI*2); ctx.fill();
            }
        }
        const motes = Array.from({length: 400}, () => new Mote());
        function loop() {
            ctx.fillStyle = 'rgba(5,5,5,0.2)'; ctx.fillRect(0, 0, w, h);
            for (let m of motes) { m.update(); m.draw(); }
            requestAnimationFrame(loop);
        }
        loop();
        window.addEventListener('resize', () => { w = c.width = window.innerWidth; h = c.height = window.innerHeight; });
    </script>
</body>
</html>
"#;

const FIREFLY_REST_HTML: &str = r#"
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <style>body, html { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background: #020502; } canvas { display: block; }</style>
</head>
<body>
    <canvas id="c"></canvas>
    <script>
        const c = document.getElementById('c');
        const ctx = c.getContext('2d');
        let w = c.width = window.innerWidth, h = c.height = window.innerHeight;
        let icons = []; window.__dispatch_icons = (data) => icons = data;
        
        let hue = 70; // Yellow green
        document.addEventListener('click', () => { hue = (hue + 45) % 360; });

        class Firefly {
            constructor() {
                this.x = Math.random()*w; this.y = Math.random()*h;
                this.vx = (Math.random()-0.5)*2; this.vy = (Math.random()-0.5)*2;
                this.rest = 0; this.phase = Math.random()*Math.PI*2;
            }
            update() {
                if (this.rest > 0) {
                    this.rest--;
                    this.phase += 0.05;
                    if (this.rest === 0) {
                        this.vx = (Math.random()-0.5)*4; this.vy = -Math.random()*3-1;
                    }
                    return;
                }
                
                this.x += this.vx; this.y += this.vy;
                this.vx += (Math.random()-0.5)*0.5; this.vy += (Math.random()-0.5)*0.5;
                let speed = Math.sqrt(this.vx*this.vx + this.vy*this.vy);
                if (speed > 2) { this.vx = (this.vx/speed)*2; this.vy = (this.vy/speed)*2; }
                
                for (let icon of icons) {
                    let hitX = icon.x + 10, hitY = icon.y + 10, hitW = icon.w - 20;
                    if (this.vy > 0 && this.x > hitX && this.x < hitX+hitW && this.y > hitY && this.y < hitY+20) {
                        if (Math.random() > 0.5) {
                            this.rest = Math.floor(Math.random()*200)+100;
                            this.y = hitY; this.vy = 0; this.vx = 0;
                        }
                    }
                }
                
                if (this.x<0||this.x>w) this.vx*=-1;
                if (this.y<0||this.y>h) this.vy*=-1;
                this.phase += 0.1;
            }
            draw() {
                let glow = (Math.sin(this.phase) + 1) / 2; // 0 to 1
                ctx.fillStyle = `hsla(${hue}, 100%, 70%, ${glow})`;
                ctx.beginPath(); ctx.arc(this.x, this.y, 2, 0, Math.PI*2); ctx.fill();
                ctx.shadowBlur = 10; ctx.shadowColor = `hsl(${hue}, 100%, 50%)`;
                ctx.fill(); ctx.shadowBlur = 0;
            }
        }
        const bugs = Array.from({length: 100}, () => new Firefly());
        function loop() {
            ctx.fillStyle = 'rgba(2,5,2,0.3)'; ctx.fillRect(0, 0, w, h);
            for (let b of bugs) { b.update(); b.draw(); }
            requestAnimationFrame(loop);
        }
        loop();
        window.addEventListener('resize', () => { w = c.width = window.innerWidth; h = c.height = window.innerHeight; });
    </script>
</body>
</html>
"#;

pub fn init_extra_interactives(dir: &PathBuf) -> Result<(), String> {
    let mapping = vec![
        ("neon_waves.html", NEON_WAVES_HTML),
        ("cursor_trail.html", CURSOR_TRAIL_HTML),
        ("hexagon_grid.html", HEXAGON_GRID_HTML),
        ("starfield.html", STARFIELD_HTML),
        ("particle_vortex.html", PARTICLE_VORTEX_HTML),
        ("boids_flock.html", BOIDS_FLOCK_HTML),
        ("bubble_pop.html", BUBBLE_POP_HTML),
        ("gravity_points.html", GRAVITY_POINTS_HTML),
        ("interactive_ripple.html", INTERACTIVE_RIPPLE_HTML),
        ("bouncing_dvd.html", BOUNCING_DVD_HTML),
        ("icon_physics.html", ICON_PHYSICS_HTML),
        ("matrix_rain_physics.html", MATRIX_RAIN_PHYSICS_HTML),
        ("snow_physics.html", SNOW_PHYSICS_HTML),
        ("fluid_drops.html", FLUID_DROPS_HTML),
        ("laser_reflections.html", LASER_REFLECTIONS_HTML),
        ("magnetic_swarm.html", MAGNETIC_SWARM_HTML),
        ("firefly_rest.html", FIREFLY_REST_HTML),
    ];

    for (filename, html) in mapping {
        let path = dir.join(filename);
        if !path.exists() {
            fs::write(&path, html).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

pub fn get_extra_interactives(dir: &PathBuf) -> Vec<VideoResult> {
    let mapping = vec![
        ("neon_waves.html", "interactive_neon_waves", "Neon Waves", "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?q=80&w=640&auto=format&fit=crop", vec!["neon", "waves"]),
        ("cursor_trail.html", "interactive_cursor_trail", "Cursor Trail", "https://images.unsplash.com/photo-1504333638930-c8787321ffa0?q=80&w=640&auto=format&fit=crop", vec!["fire", "trail"]),
        ("hexagon_grid.html", "interactive_hexagon_grid", "Hexagon Grid", "https://images.unsplash.com/photo-1550684376-efcbd6e3f031?q=80&w=640&auto=format&fit=crop", vec!["hex", "grid"]),
        ("starfield.html", "interactive_starfield", "Warp Starfield", "https://images.unsplash.com/photo-1462331940025-496dfbfc7564?q=80&w=640&auto=format&fit=crop", vec!["space", "stars"]),
        ("particle_vortex.html", "interactive_particle_vortex", "Particle Vortex", "https://images.unsplash.com/photo-1534447677768-be436bb09401?q=80&w=640&auto=format&fit=crop", vec!["vortex", "particles"]),
        ("boids_flock.html", "interactive_boids_flock", "Boids Flock", "https://images.unsplash.com/photo-1506260408121-e353d10b87c7?q=80&w=640&auto=format&fit=crop", vec!["flock", "birds"]),
        ("bubble_pop.html", "interactive_bubble_pop", "Bubble Pop", "https://images.unsplash.com/photo-1518837695005-2083093ee35b?q=80&w=640&auto=format&fit=crop", vec!["bubbles", "pop"]),
        ("gravity_points.html", "interactive_gravity_points", "Gravity Points", "https://images.unsplash.com/photo-1506318137071-a8e063b4bec0?q=80&w=640&auto=format&fit=crop", vec!["gravity", "physics"]),
        ("interactive_ripple.html", "interactive_ripple_water", "Interactive Ripples", "https://images.unsplash.com/photo-1518837695005-2083093ee35b?q=80&w=640&auto=format&fit=crop", vec!["water", "ripple"]),
        ("bouncing_dvd.html", "interactive_bouncing_dvd", "Bouncing DVD", "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?q=80&w=640&auto=format&fit=crop", vec!["dvd", "meme"]),
        ("icon_physics.html", "interactive_icon_physics", "Icon Physics Engine", "https://images.unsplash.com/photo-1534447677768-be436bb09401?q=80&w=640&auto=format&fit=crop", vec!["physics", "icons", "rain", "icon_physics"]),
        ("matrix_rain_physics.html", "interactive_matrix_rain_physics", "Matrix Rain Icons", "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?q=80&w=640&auto=format&fit=crop", vec!["physics", "icons", "matrix", "icon_physics"]),
        ("snow_physics.html", "interactive_snow_physics", "Snow Accumulation", "https://images.unsplash.com/photo-1483921020237-2ff51e8e4b22?q=80&w=640&auto=format&fit=crop", vec!["physics", "icons", "snow", "icon_physics"]),
        ("fluid_drops.html", "interactive_fluid_drops", "Fluid Drops Splash", "https://images.unsplash.com/photo-1527066236129-8bc1862086b5?q=80&w=640&auto=format&fit=crop", vec!["physics", "icons", "water", "icon_physics"]),
        ("laser_reflections.html", "interactive_laser_reflections", "Laser Reflections", "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?q=80&w=640&auto=format&fit=crop", vec!["physics", "icons", "laser", "icon_physics"]),
        ("magnetic_swarm.html", "interactive_magnetic_swarm", "Magnetic Swarm", "https://images.unsplash.com/photo-1518837695005-2083093ee35b?q=80&w=640&auto=format&fit=crop", vec!["physics", "icons", "swarm", "icon_physics"]),
        ("firefly_rest.html", "interactive_firefly_rest", "Firefly Rest", "https://images.unsplash.com/photo-1462331940025-496dfbfc7564?q=80&w=640&auto=format&fit=crop", vec!["physics", "icons", "firefly", "icon_physics"]),
    ];

    let mut results = Vec::new();
    for (filename, id, title, thumb, extra_tags) in mapping {
        let path = dir.join(filename);
        if path.exists() {
            let mut tags = vec!["interactive".to_string(), "html".to_string()];
            tags.extend(extra_tags.iter().map(|s| s.to_string()));
            results.push(VideoResult {
                id: id.to_string(),
                video_url: "local_interactive".to_string(),
                thumbnail_url: thumb.to_string(),
                local_path: path.to_string_lossy().to_string(),
                duration: 0.0,
                width: 1920,
                height: 1080,
                source: "interactive".to_string(),
                start_time: None,
                end_time: None,
                tags: Some(tags),
            });
        }
    }
    results
}
