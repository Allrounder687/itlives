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
