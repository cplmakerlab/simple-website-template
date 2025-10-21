# Vector Studio - Customization Guide

## 🎨 Color Scheme

The website uses a modern dark theme with the following color palette:

### Primary Colors
- **Primary Cyan**: `#00d9ff` - Main accent color for buttons, icons, and highlights
- **Secondary Purple**: `#7b2cbf` - Secondary accent used in gradients
- **Accent Pink**: `#ff006e` - Additional accent for special elements

### Background Colors
- **Dark Background**: `#0a0a0f` - Main page background
- **Card Background**: `#13131a` - Cards and sections
- **Card Hover**: `#1a1a24` - Hover state for interactive elements

### Text Colors
- **Primary Text**: `#ffffff` - Main headings and important text
- **Secondary Text**: `#b4b4c8` - Body text and descriptions
- **Border Color**: `#252530` - Subtle borders and dividers

### Gradients
- **Primary Gradient**: `linear-gradient(135deg, #00d9ff 0%, #7b2cbf 100%)`
- **Secondary Gradient**: `linear-gradient(135deg, #7b2cbf 0%, #ff006e 100%)`

## 🔧 Quick Customizations

### Change Logo
Replace `assets/images/logo.jpg` with your own logo (recommended size: 200x200px)

### Change Hero Background
Replace `assets/images/background.jpg` with your background image (recommended size: 1920x1080px or higher)

### Update Company Name
1. Open `index.html`
2. Find all instances of "Vector Studio" (Ctrl+F)
3. Replace with your company name

### Update Contact Information
In `index.html`, find the Contact section and update:
- Email address
- Discord link
- Any other contact methods

### Modify Colors
In `assets/css/style.css`, find the `:root` section (lines 11-24) and adjust:
```css
:root {
    --primary-color: #00d9ff;      /* Change your main color */
    --secondary-color: #7b2cbf;    /* Change secondary color */
    --accent-color: #ff006e;       /* Change accent color */
}
```

### Add Products
In `index.html`, find the Products section and duplicate this structure:
```html
<div class="product-card">
    <div class="product-image">
        <img src="assets/images/product.jpg" alt="Product Name">
        <div class="product-overlay">
            <a href="#" class="btn btn-small">View Details</a>
        </div>
    </div>
    <div class="product-info">
        <h3>Product Name</h3>
        <p>Product description goes here.</p>
        <div class="product-footer">
            <span class="price">$XX.XX</span>
            <a href="#" class="btn btn-primary btn-small">Purchase</a>
        </div>
    </div>
</div>
```

### Add Services
In `index.html`, find the Services section and add:
```html
<div class="service-card">
    <div class="service-icon">
        <i class="fas fa-icon-name"></i>
    </div>
    <h3>Service Name</h3>
    <p>Service description here.</p>
</div>
```

Find Font Awesome icons at: https://fontawesome.com/icons

### Modify Statistics
In the About section, update the stats:
```html
<div class="stat-item">
    <h3>500+</h3>
    <p>Projects Completed</p>
</div>
```

## 📱 Social Media Links

Update social media links in the footer section:
```html
<div class="social-links">
    <a href="YOUR_DISCORD_LINK" aria-label="Discord"><i class="fab fa-discord"></i></a>
    <a href="YOUR_TWITTER_LINK" aria-label="Twitter"><i class="fab fa-twitter"></i></a>
    <a href="YOUR_GITHUB_LINK" aria-label="GitHub"><i class="fab fa-github"></i></a>
    <a href="YOUR_YOUTUBE_LINK" aria-label="YouTube"><i class="fab fa-youtube"></i></a>
</div>
```

## 🖼️ Image Recommendations

### Logo (`assets/images/logo.jpg`)
- Dimensions: 200x200px minimum
- Format: JPG, PNG, or SVG
- Transparent background recommended

### Hero Background (`assets/images/background.jpg`)
- Dimensions: 1920x1080px or higher
- Format: JPG (optimized for web)
- Keep file size under 500KB for fast loading

### Product Images
- Dimensions: 800x600px recommended
- Format: JPG or PNG
- Consistent aspect ratio across all products

### Portfolio Images
- Dimensions: 800x600px recommended
- Format: JPG or PNG
- Showcase your best work

## 🔌 Backend Integration

### Contact Form
The contact form currently shows a demo notification. To integrate with a backend:

1. Open `assets/js/script.js`
2. Find the contact form handler (around line 163)
3. Uncomment and modify the fetch API call:
```javascript
fetch('/api/contact', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
    },
    body: JSON.stringify(formData)
})
.then(response => response.json())
.then(data => {
    showNotification('Message sent successfully!', 'success');
    contactForm.reset();
})
.catch(error => {
    showNotification('Error sending message. Please try again.', 'error');
});
```

### Payment Integration
For product purchases, consider integrating:
- **Stripe** - For credit card payments
- **PayPal** - For PayPal and credit cards
- **Tebex** - Popular in the FiveM community
- **Discord Bots** - For automated delivery

## 📊 SEO Optimization

Update meta tags in `index.html`:
```html
<meta name="description" content="Your custom description">
<meta name="keywords" content="Your, Keywords, Here">
<title>Your Custom Title</title>
```

## 🚀 Performance Tips

1. **Optimize Images**: Use tools like TinyPNG to compress images
2. **Lazy Loading**: Add `loading="lazy"` to images below the fold
3. **Minify CSS/JS**: Use minification tools before deployment
4. **CDN**: Consider using a CDN for static assets
5. **Caching**: Enable browser caching in your server config

## 📝 Adding New Sections

1. Add HTML structure in `index.html`
2. Add navigation link in navbar
3. Style in `assets/css/style.css`
4. Add any interactions in `assets/js/script.js`

Example:
```html
<!-- Navigation -->
<li><a href="#new-section" class="nav-link">New Section</a></li>

<!-- Section -->
<section id="new-section" class="section">
    <div class="container">
        <div class="section-header">
            <h2 class="section-title">New Section Title</h2>
            <p class="section-subtitle">Subtitle here</p>
        </div>
        <!-- Your content -->
    </div>
</section>
```

## 🎯 Browser Testing

Always test your changes on:
- Chrome (Desktop & Mobile)
- Firefox
- Safari
- Edge
- Mobile devices (iOS & Android)

## 💡 Tips

1. **Consistency**: Keep colors, fonts, and spacing consistent
2. **Mobile First**: Always test on mobile devices
3. **Performance**: Optimize images and minimize HTTP requests
4. **Accessibility**: Use proper alt tags and semantic HTML
5. **Backup**: Always keep a backup before making major changes

## 📞 Need Help?

If you need custom development or have questions:
- Check the main README.md for basic setup
- Review the code comments in CSS and JS files
- Contact Vector Studio for custom work

---

© 2025 Vector Studio. All rights reserved.

