# AGV Protocol Investor Portal

A comprehensive investor portal built with Next.js 14+ for AGV Protocol, providing access to technical documentation, financial models, legal documents, ESG reports, and brand assets.

## 🚀 Features

- **Modern Tech Stack**: Next.js 14+ with App Router, TypeScript, and Tailwind CSS
- **Responsive Design**: Mobile-first design with clean, investor-focused UI
- **Smooth Animations**: Framer Motion for page transitions and micro-interactions
- **Document Management**: PDF viewer with fallback for document previews
- **Firebase Ready**: Prepared for Firebase Admin SDK integration
- **SEO Optimized**: Proper metadata and Open Graph tags

## 📁 Project Structure

```
investor-portal/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── tech/              # Technology documentation
│   │   ├── financials/        # Financial models and projections
│   │   ├── legal/             # Legal documents and compliance
│   │   ├── esg/               # ESG and sustainability reports
│   │   ├── brandkit/          # Brand assets and guidelines
│   │   ├── contact/           # Contact form and information
│   │   ├── investor/          # Central data room index
│   │   ├── layout.tsx         # Root layout with fonts and metadata
│   │   ├── page.tsx           # Home page
│   │   └── globals.css        # Global styles with AGV color palette
│   ├── components/            # Reusable UI components
│   │   ├── Button.tsx         # Button component with variants
│   │   ├── Card.tsx           # Card component with hover effects
│   │   ├── Layout.tsx         # Page layout wrapper
│   │   ├── Navbar.tsx         # Navigation component
│   │   ├── Footer.tsx         # Footer component
│   │   ├── PDFViewer.tsx      # PDF document viewer
│   │   └── SectionHeader.tsx  # Section header component
│   └── lib/
│       └── firestore.ts       # Firestore placeholder utility
├── public/                    # Static assets
├── .env.example              # Environment variables template
└── README.md                 # This file
```

## 🎨 Design System

### Color Palette
- **Primary**: #3399FF (AGV Blue)
- **Secondary**: #F8FAFC (Light Gray)
- **Text**: #171717 (Dark Gray)
- **Muted**: #64748B (Medium Gray)

### Typography
- **Primary Font**: Inter (Google Fonts)
- **Secondary Font**: Poppins (Google Fonts)
- **Fallback**: System fonts

## 🛠️ Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd investor-portal
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your configuration
   ```

4. **Run the development server**
```bash
npm run dev
   ```

5. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## 📄 Available Pages

| Route | Description |
|-------|-------------|
| `/` | Home page with overview and CTAs |
| `/tech` | Technology documentation and architecture |
| `/financials` | Financial models and projections |
| `/legal` | Legal documents and compliance |
| `/esg` | ESG reports and sustainability data |
| `/brandkit` | Brand assets and guidelines |
| `/contact` | Contact form and information |
| `/investor` | Central data room index |

## 🔧 Configuration

### Environment Variables

Copy `.env.example` to `.env.local` and configure:

- **Firebase**: For future document storage integration
- **Contact Form**: For form submission handling
- **Analytics**: Google Analytics and Hotjar (optional)

### Customization

1. **Colors**: Update CSS variables in `src/app/globals.css`
2. **Content**: Modify dummy data in `src/lib/firestore.ts`
3. **Components**: Customize components in `src/components/`

## 🚀 Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Connect your repository to Vercel
3. Deploy with default settings

### Other Platforms

The app can be deployed to any platform that supports Next.js:
- Netlify
- AWS Amplify
- Railway
- DigitalOcean App Platform

## 🔮 Future Enhancements

### Phase 1: Firebase Integration
- [ ] Connect to Firebase Firestore for real document storage
- [ ] Implement user authentication for confidential documents
- [ ] Add document upload and management

### Phase 2: Advanced Features
- [ ] Real-time document updates
- [ ] Advanced search and filtering
- [ ] Document versioning
- [ ] Analytics dashboard

### Phase 3: Enterprise Features
- [ ] Multi-tenant support
- [ ] Advanced security controls
- [ ] API integration
- [ ] Custom branding options

## 📝 Content Management

Currently using placeholder data in `src/lib/firestore.ts`. To add real content:

1. Update the `dummyData` object with your actual documents
2. Replace placeholder URLs with real document links
3. Add new categories as needed

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is proprietary to AGV Protocol. All rights reserved.

## 📞 Support

For technical support or questions:
- Email: developers@agvprotocol.com
- Documentation: [Link to docs]
- Issues: [GitHub Issues]

---