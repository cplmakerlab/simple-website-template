// ===================================
// Vector Studio - FiveM Development Store
// JavaScript Functionality
// ===================================

(function() {
    'use strict';

    // ===================================
    // DOM Elements
    // ===================================
    const navbar = document.getElementById('navbar');
    const navMenu = document.getElementById('nav-menu');
    const hamburger = document.getElementById('hamburger');
    const navLinks = document.querySelectorAll('.nav-link');
    const scrollTopBtn = document.getElementById('scrollTop');
    const contactForm = document.getElementById('contactForm');

    // ===================================
    // Navigation Functionality
    // ===================================
    
    // Sticky navbar on scroll
    window.addEventListener('scroll', () => {
        if (window.scrollY > 100) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }

        // Show/hide scroll to top button
        if (window.scrollY > 500) {
            scrollTopBtn.classList.add('show');
        } else {
            scrollTopBtn.classList.remove('show');
        }
    });

    // Hamburger menu toggle
    if (hamburger) {
        hamburger.addEventListener('click', () => {
            hamburger.classList.toggle('active');
            navMenu.classList.toggle('active');
            document.body.style.overflow = navMenu.classList.contains('active') ? 'hidden' : '';
        });
    }

    // Smooth scrolling and active nav link
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            
            // Remove active class from all links
            navLinks.forEach(nav => nav.classList.remove('active'));
            
            // Add active class to clicked link
            link.classList.add('active');
            
            // Close mobile menu if open
            if (navMenu.classList.contains('active')) {
                navMenu.classList.remove('active');
                hamburger.classList.remove('active');
                document.body.style.overflow = '';
            }
            
            // Smooth scroll to section
            const targetId = link.getAttribute('href');
            const targetSection = document.querySelector(targetId);
            
            if (targetSection) {
                const navHeight = navbar.offsetHeight;
                const targetPosition = targetSection.offsetTop - navHeight;
                
                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });

    // ===================================
    // Scroll to Top Button
    // ===================================
    if (scrollTopBtn) {
        scrollTopBtn.addEventListener('click', () => {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        });
    }

    // ===================================
    // Active Section Detection on Scroll
    // ===================================
    const sections = document.querySelectorAll('section[id]');
    
    const observerOptions = {
        root: null,
        rootMargin: '-100px',
        threshold: 0.2
    };

    const sectionObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const id = entry.target.getAttribute('id');
                const correspondingLink = document.querySelector(`.nav-link[href="#${id}"]`);
                
                if (correspondingLink) {
                    navLinks.forEach(link => link.classList.remove('active'));
                    correspondingLink.classList.add('active');
                }
            }
        });
    }, observerOptions);

    sections.forEach(section => {
        sectionObserver.observe(section);
    });

    // ===================================
    // Scroll Reveal Animation
    // ===================================
    const revealElements = document.querySelectorAll('.service-card, .product-card, .portfolio-item, .stat-item');
    
    const revealOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.15
    };

    const revealObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry, index) => {
            if (entry.isIntersecting) {
                setTimeout(() => {
                    entry.target.style.opacity = '1';
                    entry.target.style.transform = 'translateY(0)';
                }, index * 100);
                revealObserver.unobserve(entry.target);
            }
        });
    }, revealOptions);

    revealElements.forEach(element => {
        element.style.opacity = '0';
        element.style.transform = 'translateY(30px)';
        element.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        revealObserver.observe(element);
    });

    // ===================================
    // Contact Form Handling
    // ===================================
    if (contactForm) {
        contactForm.addEventListener('submit', (e) => {
            e.preventDefault();
            
            // Get form values
            const formData = {
                name: document.getElementById('name').value,
                email: document.getElementById('email').value,
                subject: document.getElementById('subject').value,
                message: document.getElementById('message').value
            };

            // Basic validation
            if (!formData.name || !formData.email || !formData.subject || !formData.message) {
                showNotification('Please fill in all fields', 'error');
                return;
            }

            // Email validation
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(formData.email)) {
                showNotification('Please enter a valid email address', 'error');
                return;
            }

            // Simulate form submission (replace with actual backend call)
            showNotification('Message sent successfully! We\'ll get back to you soon.', 'success');
            contactForm.reset();

            // In production, you would send this to your backend:
            // fetch('/api/contact', {
            //     method: 'POST',
            //     headers: {
            //         'Content-Type': 'application/json',
            //     },
            //     body: JSON.stringify(formData)
            // })
            // .then(response => response.json())
            // .then(data => {
            //     showNotification('Message sent successfully!', 'success');
            //     contactForm.reset();
            // })
            // .catch(error => {
            //     showNotification('Error sending message. Please try again.', 'error');
            // });
        });
    }

    // ===================================
    // Notification System
    // ===================================
    function showNotification(message, type = 'info') {
        // Remove existing notification if any
        const existingNotification = document.querySelector('.notification');
        if (existingNotification) {
            existingNotification.remove();
        }

        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i>
            <span>${message}</span>
        `;

        // Add styles
        Object.assign(notification.style, {
            position: 'fixed',
            top: '100px',
            right: '20px',
            background: type === 'success' ? 'linear-gradient(135deg, #00d9ff 0%, #7b2cbf 100%)' : 'linear-gradient(135deg, #ff006e 0%, #7b2cbf 100%)',
            color: '#ffffff',
            padding: '1.5rem 2.5rem',
            borderRadius: '10px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
            zIndex: '9999',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            fontSize: '1.5rem',
            fontWeight: '500',
            animation: 'slideInRight 0.4s ease-out',
            maxWidth: '400px'
        });

        // Add to DOM
        document.body.appendChild(notification);

        // Auto remove after 4 seconds
        setTimeout(() => {
            notification.style.animation = 'slideOutRight 0.4s ease-in';
            setTimeout(() => {
                notification.remove();
            }, 400);
        }, 4000);
    }

    // Add notification animations to the page
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideInRight {
            from {
                transform: translateX(400px);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        
        @keyframes slideOutRight {
            from {
                transform: translateX(0);
                opacity: 1;
            }
            to {
                transform: translateX(400px);
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(style);

    // ===================================
    // Parallax Effect on Hero Section
    // ===================================
    const hero = document.querySelector('.hero');
    if (hero) {
        window.addEventListener('scroll', () => {
            const scrolled = window.scrollY;
            const parallaxSpeed = 0.5;
            hero.style.transform = `translateY(${scrolled * parallaxSpeed}px)`;
        });
    }

    // ===================================
    // Cursor Glow Effect (Optional Enhancement)
    // ===================================
    const createCursorGlow = () => {
        const cursorGlow = document.createElement('div');
        cursorGlow.className = 'cursor-glow';
        
        Object.assign(cursorGlow.style, {
            position: 'fixed',
            width: '300px',
            height: '300px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(0, 217, 255, 0.1) 0%, transparent 70%)',
            pointerEvents: 'none',
            zIndex: '9998',
            transform: 'translate(-50%, -50%)',
            transition: 'opacity 0.3s ease',
            opacity: '0'
        });

        document.body.appendChild(cursorGlow);

        document.addEventListener('mousemove', (e) => {
            cursorGlow.style.left = e.clientX + 'px';
            cursorGlow.style.top = e.clientY + 'px';
            cursorGlow.style.opacity = '1';
        });

        document.addEventListener('mouseleave', () => {
            cursorGlow.style.opacity = '0';
        });
    };

    // Enable cursor glow on desktop only
    if (window.innerWidth > 992) {
        createCursorGlow();
    }

    // ===================================
    // Preloader (Optional)
    // ===================================
    window.addEventListener('load', () => {
        document.body.classList.add('loaded');
        
        // Hide any preloader if you add one
        const preloader = document.querySelector('.preloader');
        if (preloader) {
            setTimeout(() => {
                preloader.style.opacity = '0';
                setTimeout(() => {
                    preloader.style.display = 'none';
                }, 300);
            }, 500);
        }
    });

    // ===================================
    // Performance Optimization
    // ===================================
    
    // Debounce function for scroll events
    function debounce(func, wait = 10, immediate = true) {
        let timeout;
        return function() {
            const context = this;
            const args = arguments;
            const later = function() {
                timeout = null;
                if (!immediate) func.apply(context, args);
            };
            const callNow = immediate && !timeout;
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
            if (callNow) func.apply(context, args);
        };
    }

    // Apply debounce to scroll-heavy operations
    const efficientScrollHandler = debounce(() => {
        // Add any additional scroll-based functionality here
    });

    window.addEventListener('scroll', efficientScrollHandler);

    // ===================================
    // Console Branding (Easter Egg)
    // ===================================
    console.log(
        '%c Vector Studio %c FiveM Development ',
        'background: linear-gradient(135deg, #00d9ff 0%, #7b2cbf 100%); color: white; padding: 10px 20px; font-size: 20px; font-weight: bold;',
        'background: #13131a; color: #00d9ff; padding: 10px 20px; font-size: 14px;'
    );
    console.log(
        '%c Looking for a developer? Contact us! ',
        'color: #00d9ff; font-size: 12px;'
    );

})();
