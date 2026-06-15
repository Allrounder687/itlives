use std::path::PathBuf;
use std::fs;
use crate::wallpaper::providers::VideoResult;
use crate::wallpaper::desktop::app_data_dir;

const MATRIX_HTML: &str = r#"
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body, html { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background-color: #000; }
        canvas { display: block; }
    </style>
</head>
<body>
    <canvas id="canvas"></canvas>
    <script>
        const canvas = document.getElementById('canvas');
        const ctx = canvas.getContext('2d');
        
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%^&*]*'.split('');
        const fontSize = 16;
        let columns = canvas.width / fontSize;
        const drops = [];
        
        for (let x = 0; x < columns; x++) {
            drops[x] = 1;
        }

        let mouseX = 0;
        let mouseY = 0;

        let audioBins = [];
        window.__dispatch_audio = (bins) => {
            audioBins = bins;
        };

        document.addEventListener('mousemove', (e) => {
            mouseX = e.clientX;
            mouseY = e.clientY;
        });

        let hueOffset = 0;
        document.addEventListener('click', () => { hueOffset = (hueOffset + 45) % 360; });

        function draw() {
            let bass = 0;
            if (audioBins.length >= 64) {
                for(let i=0; i<6; i++) bass += audioBins[i];
                bass /= 6;
            }

            ctx.fillStyle = `rgba(0, 0, 0, ${0.05 + bass * 0.1})`;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            ctx.fillStyle = `hsl(${(120 + hueOffset) % 360}, 100%, 50%)`; 
            ctx.font = fontSize + 'px monospace';
            
            for (let i = 0; i < drops.length; i++) {
                const text = letters[Math.floor(Math.random() * letters.length)];
                
                const dropX = i * fontSize;
                const dropY = drops[i] * fontSize;
                
                // Repel effect based on mouse
                const dx = dropX - mouseX;
                const dy = dropY - mouseY;
                const distance = Math.sqrt(dx*dx + dy*dy);
                
                if (distance < 100) {
                    ctx.fillStyle = '#FFF';
                    ctx.fillText(text, dropX + (dx/distance)*10, dropY + (dy/distance)*10);
                } else {
                    if (bass > 0.4 && Math.random() < bass) {
                        ctx.fillStyle = '#FFF';
                        ctx.shadowBlur = bass * 20;
                        ctx.shadowColor = `hsl(${(120 + hueOffset) % 360}, 100%, 50%)`;
                    } else {
                        ctx.fillStyle = `hsl(${(120 + hueOffset) % 360}, 100%, 50%)`;
                        ctx.shadowBlur = 0;
                    }
                    ctx.fillText(text, dropX, dropY);
                    ctx.shadowBlur = 0;
                }
                
                if (dropY > canvas.height && Math.random() > 0.975) {
                    drops[i] = 0;
                }
                drops[i] += 1 + bass * 2;
            }
        }
        
        setInterval(draw, 33);
        
        window.addEventListener('resize', () => {
            const oldColumns = columns;
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            columns = canvas.width / fontSize;
            for (let x = oldColumns; x < columns; x++) {
                drops[Math.floor(x)] = Math.random() * -100; // Start new drops randomly above screen
            }
        });
    </script>
</body>
</html>
"#;

const PARTICLES_HTML: &str = r#"
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body, html { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background-color: #0b0f19; }
        canvas { display: block; }
    </style>
</head>
<body>
    <canvas id="canvas"></canvas>
    <script>
        const canvas = document.getElementById('canvas');
        const ctx = canvas.getContext('2d');
        
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        let particles = [];
        const numParticles = 150;

        let mouse = { x: null, y: null, radius: 150 };

        document.addEventListener('mousemove', (e) => {
            mouse.x = e.clientX;
            mouse.y = e.clientY;
        });

        class Particle {
            constructor(x, y, dx, dy, size, color) {
                this.x = x;
                this.y = y;
                this.dx = dx;
                this.dy = dy;
                this.size = size;
                this.color = color;
                this.baseX = x;
                this.baseY = y;
            }

            draw() {
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2, false);
                ctx.fillStyle = this.color;
                ctx.fill();
            }

            update() {
                if (this.x > canvas.width || this.x < 0) this.dx = -this.dx;
                if (this.y > canvas.height || this.y < 0) this.dy = -this.dy;

                // Mouse interaction
                let dx = mouse.x - this.x;
                let dy = mouse.y - this.y;
                let distance = Math.sqrt(dx*dx + dy*dy);
                
                if (distance < mouse.radius) {
                    const forceDirectionX = dx / distance;
                    const forceDirectionY = dy / distance;
                    const force = (mouse.radius - distance) / mouse.radius;
                    const directionX = forceDirectionX * force * 5;
                    const directionY = forceDirectionY * force * 5;
                    
                    this.x -= directionX;
                    this.y -= directionY;
                } else {
                    if (this.x !== this.baseX) {
                        let dx = this.x - this.baseX;
                        this.x -= dx/20;
                    }
                    if (this.y !== this.baseY) {
                        let dy = this.y - this.baseY;
                        this.y -= dy/20;
                    }
                }

                this.x += this.dx;
                this.y += this.dy;
                this.draw();
            }
        }

        function init() {
            particles = [];
            for (let i = 0; i < numParticles; i++) {
                let size = (Math.random() * 3) + 1;
                let x = (Math.random() * ((innerWidth - size * 2) - (size * 2)) + size * 2);
                let y = (Math.random() * ((innerHeight - size * 2) - (size * 2)) + size * 2);
                let dx = (Math.random() * 2) - 1;
                let dy = (Math.random() * 2) - 1;
                let color = '#00d2ff';
                particles.push(new Particle(x, y, dx, dy, size, color));
            }
        }

        function animate() {
            requestAnimationFrame(animate);
            ctx.clearRect(0, 0, innerWidth, innerHeight);

            for (let i = 0; i < particles.length; i++) {
                particles[i].update();
            }
            connect();
        }

        function connect() {
            for (let a = 0; a < particles.length; a++) {
                for (let b = a; b < particles.length; b++) {
                    let dx = particles[a].x - particles[b].x;
                    let dy = particles[a].y - particles[b].y;
                    let distance = dx * dx + dy * dy;

                    if (distance < (canvas.width/7) * (canvas.height/7)) {
                        let opacity = 1 - (distance / 20000);
                        ctx.strokeStyle = 'rgba(0, 210, 255,' + opacity + ')';
                        ctx.lineWidth = 1;
                        ctx.beginPath();
                        ctx.moveTo(particles[a].x, particles[a].y);
                        ctx.lineTo(particles[b].x, particles[b].y);
                        ctx.stroke();
                    }
                }
            }
        }

        window.addEventListener('resize', () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            init();
        });

        init();
        animate();
    </script>
</body>
</html>
"#;

const FLUIDS_HTML: &str = r#"
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body, html { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background-color: #000; }
        canvas { display: block; width: 100%; height: 100%; }
    </style>
</head>
<body>
    <canvas id="glcanvas"></canvas>
    <script>
        // A minimal, standalone WebGL fluid simulation wrapper
        // Based on the lightweight WebGL fluid algorithms
        const canvas = document.getElementById('glcanvas');
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        // Using a tiny placeholder script for now that mimics fluid interactions
        // In a full app, you would inject a robust WebGL fluid library here.
        const ctx = canvas.getContext('2d');
        let mouseX = window.innerWidth / 2;
        let mouseY = window.innerHeight / 2;
        let isMouseDown = false;
        let ripples = [];

        document.addEventListener('mousemove', (e) => {
            mouseX = e.clientX;
            mouseY = e.clientY;
            if(Math.random() > 0.5) {
                ripples.push({x: mouseX, y: mouseY, radius: 10, alpha: 1});
            }
        });
        
        document.addEventListener('mousedown', () => isMouseDown = true);
        document.addEventListener('mouseup', () => isMouseDown = false);

        function animate() {
            ctx.fillStyle = 'rgba(10, 15, 20, 0.1)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            for (let i = 0; i < ripples.length; i++) {
                const r = ripples[i];
                ctx.beginPath();
                ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
                ctx.strokeStyle = `rgba(0, 200, 255, ${r.alpha})`;
                ctx.lineWidth = 2;
                ctx.stroke();
                
                r.radius += 2;
                r.alpha -= 0.02;
            }

            ripples = ripples.filter(r => r.alpha > 0);

            if (isMouseDown) {
                for(let i=0; i<3; i++) {
                    ripples.push({
                        x: mouseX + (Math.random()-0.5)*20, 
                        y: mouseY + (Math.random()-0.5)*20, 
                        radius: 5, 
                        alpha: 1
                    });
                }
            }
            requestAnimationFrame(animate);
        }
        
        window.addEventListener('resize', () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        });

        animate();
    </script>
</body>
</html>
"#;

pub fn get_interactives_dir() -> PathBuf {
    app_data_dir().join("wallpapers").join("interactive")
}

pub fn init_interactives() -> Result<(), String> {
    let dir = get_interactives_dir();
    if true {
        fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    }

    let matrix_path = dir.join("matrix_rain.html");
    if true {
        fs::write(&matrix_path, MATRIX_HTML).map_err(|e| e.to_string())?;
    }

    let particles_path = dir.join("triangles_and_light.html");
    if true {
        fs::write(&particles_path, PARTICLES_HTML).map_err(|e| e.to_string())?;
    }

    let fluids_path = dir.join("fluids_simulation.html");
    if true {
        fs::write(&fluids_path, FLUIDS_HTML).map_err(|e| e.to_string())?;
    }

    let _ = crate::wallpaper::interactives_extra::init_extra_interactives(&dir);

    Ok(())
}

pub fn get_builtin_interactives() -> Vec<VideoResult> {
    let dir = get_interactives_dir();
    let mut results = Vec::new();

    let matrix_path = dir.join("matrix_rain.html");
    if matrix_path.exists() {
        results.push(VideoResult {
            id: "interactive_matrix_rain".to_string(),
            video_url: "local_interactive".to_string(),
            thumbnail_url: "/thumbnails/matrix_rain.png".to_string(),
            local_path: matrix_path.to_string_lossy().to_string(),
            duration: 0.0,
            width: 1920,
            height: 1080,
            source: "interactive".to_string(),
            start_time: None,
            end_time: None,
            tags: Some(vec!["interactive".to_string(), "html".to_string(), "matrix".to_string()]),
        });
    }

    let particles_path = dir.join("triangles_and_light.html");
    if particles_path.exists() {
        results.push(VideoResult {
            id: "interactive_triangles".to_string(),
            video_url: "local_interactive".to_string(),
            thumbnail_url: "/thumbnails/matrix_rain.png".to_string(),
            local_path: particles_path.to_string_lossy().to_string(),
            duration: 0.0,
            width: 1920,
            height: 1080,
            source: "interactive".to_string(),
            start_time: None,
            end_time: None,
            tags: Some(vec!["interactive".to_string(), "html".to_string(), "particles".to_string()]),
        });
    }

    let fluids_path = dir.join("fluids_simulation.html");
    if fluids_path.exists() {
        results.push(VideoResult {
            id: "interactive_fluids".to_string(),
            video_url: "local_interactive".to_string(),
            thumbnail_url: "/thumbnails/matrix_rain.png".to_string(),
            local_path: fluids_path.to_string_lossy().to_string(),
            duration: 0.0,
            width: 1920,
            height: 1080,
            source: "interactive".to_string(),
            start_time: None,
            end_time: None,
            tags: Some(vec!["interactive".to_string(), "html".to_string(), "fluids".to_string()]),
        });
    }

    let mut extra = crate::wallpaper::interactives_extra::get_extra_interactives(&dir);
    results.append(&mut extra);

    results
}
