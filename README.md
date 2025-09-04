# Ashwani Kumar - Portfolio Website

A modern, responsive portfolio website showcasing my work as a System Developer Engineer specializing in DevOps, Cloud Technologies, and Test Automation.

## 🚀 Live Demo

Visit the live website: [https://ashwani983.github.io](https://ashwani983.github.io)

## 📋 Table of Contents

- [About](#about)
- [Features](#features)
- [Technologies Used](#technologies-used)
- [Project Structure](#project-structure)
- [Installation](#installation)
- [Usage](#usage)
- [Customization](#customization)
- [Blog Integration](#blog-integration)
- [Projects Showcase](#projects-showcase)
- [Performance](#performance)
- [Browser Support](#browser-support)
- [Contributing](#contributing)
- [License](#license)
- [Contact](#contact)

## 🎯 About

This portfolio website serves as a comprehensive showcase of my professional journey, technical skills, and contributions to the software development community. Built with modern web technologies, it features a clean, responsive design with smooth animations and interactive elements.

### Key Highlights:
- **Professional Experience**: System Developer Engineer I at Amazon
- **Education**: Master of Computer Applications (MCA) from CMR Institute Of Technology
- **Specialization**: DevOps, Cloud Technologies, Test Automation, CI/CD
- **Location**: Bangalore, Karnataka, India

## ✨ Features

### 🎨 Design & User Experience
- **Responsive Design**: Optimized for all devices (desktop, tablet, mobile)
- **Dark/Light Theme**: Toggle between themes with smooth transitions
- **Smooth Animations**: CSS animations and transitions for enhanced UX
- **Interactive Elements**: Hover effects, particle background, typewriter effect
- **Modern Typography**: Clean, readable fonts (Inter, JetBrains Mono, Poppins)

### 🔧 Technical Features
- **Single Page Application**: Smooth navigation without page reloads
- **Dynamic Content Loading**: Projects and blog posts loaded from JSON files
- **SEO Optimized**: Meta tags, Open Graph tags, semantic HTML
- **Performance Optimized**: Minified CSS/JS, optimized images, lazy loading
- **Accessibility**: ARIA labels, keyboard navigation, screen reader friendly

### 📱 Sections
1. **Hero Section**: Introduction with animated typewriter effect and statistics
2. **About Section**: Professional background and core technologies
3. **Projects Section**: Featured projects with detailed information
4. **Blog Section**: Latest blog posts and technical articles
5. **Contact Section**: Professional contact information and social links

## 🛠 Technologies Used

### Frontend
- **HTML5**: Semantic markup and structure
- **CSS3**: Modern styling with Flexbox, Grid, and animations
- **JavaScript (ES6+)**: Interactive functionality and dynamic content
- **Font Awesome**: Icons and visual elements

### Development Tools
- **Git**: Version control
- **GitHub Pages**: Hosting and deployment
- **VS Code**: Development environment

### External Services
- **Google Fonts**: Typography (Inter, JetBrains Mono, Poppins)
- **WordPress Blog**: External blog integration (atlcodify.wordpress.com)

## 📁 Project Structure

```
ashwani983.github.io/
├── index.html                 # Main HTML file
├── README.md                  # Project documentation
├── assets/
│   ├── css/
│   │   ├── main.css          # Main styles
│   │   ├── responsive.css    # Responsive design
│   │   └── animations.css    # Animations and transitions
│   ├── js/
│   │   ├── main.js          # Main JavaScript functionality
│   │   ├── navigation.js    # Navigation handling
│   │   └── animations.js    # Animation controls
│   ├── images/
│   │   ├── profile/         # Profile images
│   │   ├── projects/        # Project screenshots
│   │   ├── blog/           # Blog post images
│   │   └── icons/          # Icons and favicons
│   └── files/
│       └── resume.pdf       # Downloadable resume
├── data/
│   ├── projects.json        # Projects data
│   ├── blog-posts.json     # Blog posts data
│   └── skills.json         # Skills and technologies
└── pages/
    └── blog-posts/          # Individual blog post pages
```

## 🚀 Installation

### Prerequisites
- Modern web browser
- Git (for cloning)
- Local web server (optional, for development)

### Steps

1. **Clone the repository**
   ```bash
   git clone https://github.com/ashwani983/ashwani983.github.io.git
   cd ashwani983.github.io
   ```

2. **Open in browser**
   - Simply open `index.html` in your web browser
   - Or use a local server for development:
   ```bash
   # Using Python
   python -m http.server 8000
   
   # Using Node.js (http-server)
   npx http-server
   
   # Using PHP
   php -S localhost:8000
   ```

3. **Access the website**
   - Direct file: `file:///path/to/index.html`
   - Local server: `http://localhost:8000`

## 💻 Usage

### Viewing the Portfolio
1. Open the website in your browser
2. Navigate through sections using the navigation menu
3. Toggle between dark/light themes using the theme switcher
4. Download resume from the hero section
5. Explore projects and blog posts
6. Use contact information to get in touch

### Mobile Experience
- Responsive design adapts to all screen sizes
- Touch-friendly navigation and interactions
- Optimized performance for mobile devices

## 🎨 Customization

### Updating Personal Information

1. **Basic Information**: Edit `index.html`
   ```html
   <h1 class="hero-title">Hi, I'm <span class="typewriter">Your Name</span></h1>
   <p class="hero-subtitle">Your Title</p>
   ```

2. **Contact Information**: Update contact section in `index.html`
   ```html
   <p>your.email@example.com</p>
   <p>Your Location</p>
   ```

3. **Social Links**: Modify social media links
   ```html
   <a href="https://github.com/yourusername" class="social-link">
   <a href="https://linkedin.com/in/yourprofile" class="social-link">
   ```

### Adding Projects

Edit `data/projects.json`:
```json
{
  "id": "your-project-id",
  "title": "Project Title",
  "description": "Brief description",
  "technologies": ["Tech1", "Tech2"],
  "category": "Category",
  "githubUrl": "https://github.com/username/repo",
  "featured": true
}
```

### Adding Blog Posts

Edit `data/blog-posts.json`:
```json
{
  "id": "post-id",
  "title": "Post Title",
  "excerpt": "Brief excerpt",
  "author": "Your Name",
  "date": "2024-01-01",
  "tags": ["tag1", "tag2"],
  "category": "Category"
}
```

### Styling Customization

1. **Colors**: Edit CSS custom properties in `assets/css/main.css`
   ```css
   :root {
     --primary-color: #your-color;
     --secondary-color: #your-color;
   }
   ```

2. **Fonts**: Update font imports in `index.html`
   ```html
   <link href="https://fonts.googleapis.com/css2?family=YourFont" rel="stylesheet">
   ```

3. **Layout**: Modify grid layouts and spacing in CSS files

## 📝 Blog Integration

The portfolio integrates with an external WordPress blog:

### Current Integration
- **Blog URL**: [atlcodify.wordpress.com](https://atlcodify.wordpress.com)
- **Display**: Latest posts shown on homepage
- **Data Source**: `data/blog-posts.json`

### Adding New Blog Posts
1. Update `data/blog-posts.json` with new post information
2. Ensure proper categorization and tagging
3. Add SEO metadata for better search visibility

### Blog Categories
- DevOps
- Containerization
- Kubernetes
- Cloud Security
- CI/CD
- Infrastructure
- Monitoring
- Automation

## 🚀 Projects Showcase

### Featured Projects
1. **AI Chatbot using Ollama Model**
   - Modern chatbot with Flask backend
   - Responsive UI with HTML, CSS, JavaScript
   - GitHub: [AI_chatbot_using_ollama_modal](https://github.com/ashwani983/AI_chatbot_using_ollama_modal)

2. **Wi-Fi Bruteforce Tool**
   - Educational security testing tool
   - Network penetration testing capabilities
   - GitHub: [Wi-Fi-Bruteforce](https://github.com/ashwani983/Wi-Fi-Bruteforce)

3. **Diabetic Retinopathy Detection**
   - Flask web application for medical image analysis
   - OCR and AI-powered detection
   - GitHub: [Post-Surgery-Check-and-Diabetic-Retinopathy-Detection](https://github.com/ashwani983/Post-Surgery-Check-and-Diabetic-Retinopathy-Detection)

### Project Categories
- DevOps & CI/CD
- Cloud Infrastructure
- Test Automation
- Monitoring & Observability
- Security & Compliance
- AI/ML Applications

## ⚡ Performance

### Optimization Features
- **Minified Assets**: Compressed CSS and JavaScript
- **Image Optimization**: Optimized images for web
- **Lazy Loading**: Images loaded as needed
- **Caching**: Browser caching for static assets
- **CDN**: Google Fonts served from CDN

### Performance Metrics
- **Lighthouse Score**: 95+ (Performance, Accessibility, Best Practices, SEO)
- **Load Time**: < 2 seconds on 3G
- **First Contentful Paint**: < 1.5 seconds
- **Cumulative Layout Shift**: < 0.1

## 🌐 Browser Support

### Supported Browsers
- **Chrome**: 70+
- **Firefox**: 65+
- **Safari**: 12+
- **Edge**: 79+
- **Opera**: 57+

### Mobile Browsers
- **Chrome Mobile**: 70+
- **Safari iOS**: 12+
- **Samsung Internet**: 10+

### Fallbacks
- Graceful degradation for older browsers
- Progressive enhancement for modern features
- CSS Grid fallbacks with Flexbox

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. **Fork the repository**
   ```bash
   git fork https://github.com/ashwani983/ashwani983.github.io.git
   ```

2. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **Make your changes**
   - Follow existing code style
   - Test across different browsers
   - Ensure responsive design

4. **Commit your changes**
   ```bash
   git commit -m "Add: your feature description"
   ```

5. **Push to your fork**
   ```bash
   git push origin feature/your-feature-name
   ```

6. **Create a Pull Request**
   - Describe your changes
   - Include screenshots if applicable
   - Reference any related issues

### Development Guidelines
- Use semantic HTML
- Follow BEM CSS methodology
- Write clean, commented JavaScript
- Ensure accessibility compliance
- Test on multiple devices and browsers

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

### MIT License Summary
- ✅ Commercial use
- ✅ Modification
- ✅ Distribution
- ✅ Private use
- ❌ Liability
- ❌ Warranty

## 📞 Contact

### Professional Contact
- **Email**: [ashwanig983@gmail.com](mailto:ashwanig983@gmail.com)
- **LinkedIn**: [Ashwani Kumar](https://www.linkedin.com/in/ashwani-kumar-699788146/)
- **GitHub**: [@ashwani983](https://github.com/ashwani983)
- **Blog**: [ATL Codify](https://atlcodify.wordpress.com)

### Location
- **City**: Bangalore, Karnataka, India
- **Timezone**: IST (UTC+5:30)
- **Availability**: Open for freelance projects and collaborations

---

## 🙏 Acknowledgments

- **Design Inspiration**: Modern portfolio websites and UI/UX best practices
- **Icons**: Font Awesome and custom emoji icons
- **Fonts**: Google Fonts (Inter, JetBrains Mono, Poppins)
- **Hosting**: GitHub Pages
- **Community**: Open source community for tools and resources

---

**Built with ❤️ by Ashwani Kumar**

*Last updated: January 2024*
