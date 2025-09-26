# DHA Digital Services Platform

## Overview

The DHA Digital Services Platform is a comprehensive government-grade digital services system for the South African Department of Home Affairs. This platform provides secure document generation, AI-powered assistance, biometric verification, and citizen services with military-grade security features. The system handles all 21 official DHA document types, implements POPIA compliance, and integrates with government databases including NPR (National Population Register) and ABIS (Automated Biometric Identification System).

## User Preferences

Preferred communication style: Simple, everyday language.
Deployment mode: Production mode (for optimal security and performance)
Access Level: Queen Raeesa exclusive access with biometric authentication
Public AI: DHA-only simple navigation and verification

## System Architecture

### Frontend Architecture
- **React + TypeScript**: Modern component-based UI using React 18 with TypeScript for type safety
- **Vite Build System**: Fast development and optimized production builds with code splitting
- **Radix UI Components**: Accessible, unstyled UI primitives for consistent design system
- **TailwindCSS**: Utility-first CSS framework with custom DHA government color scheme
- **React Query**: Server state management with caching and background updates
- **Wouter**: Lightweight client-side routing
- **Mobile-First Design**: Responsive design optimized for mobile devices with safe area support

### Backend Architecture
- **Express.js + TypeScript**: RESTful API server with comprehensive middleware stack
- **Modular Route Structure**: Organized routes for health, AI assistant, monitoring, and biometric services
- **Multi-Server Setup**: Optimized for production mode deployment with military-grade security configurations
- **WebSocket Support**: Real-time communication for system status and notifications
- **Serverless Deployment**: Netlify Functions support for scalable cloud deployment

### Database & ORM
- **Drizzle ORM**: Type-safe database operations with PostgreSQL support
- **Comprehensive Schema**: 21 DHA document types, user management, audit trails, biometric profiles
- **SQLite Fallback**: Production mode support with automatic table creation
- **Migration System**: Database versioning and schema evolution support

### Security & Compliance
- **Military-Grade Security**: Multi-layered security with rate limiting, helmet protection, and CORS
- **POPIA Compliance**: Privacy protection with consent management and data governance
- **Biometric Encryption**: Secure storage of biometric templates with AES-256 encryption
- **Audit Trail**: Comprehensive logging for government compliance requirements
- **JWT Authentication**: Secure token-based authentication with role-based access control

### AI & Document Processing
- **OpenAI GPT-5 Integration**: Advanced AI assistant with streaming responses
- **Document Generation**: Authentic PDF generation for all 21 DHA document types
- **OCR Integration**: Enhanced South African document OCR with field extraction
- **Multi-Language Support**: All 11 official South African languages
- **Voice Services**: Speech-to-text and text-to-speech capabilities

### Government Integrations
- **Datanamix Client**: Official DHA data partner integration with OAuth2 + mTLS
- **NPR Adapter**: National Population Register verification services
- **ABIS Integration**: Automated Biometric Identification System connectivity
- **MRZ Parser**: ICAO-compliant Machine Readable Zone processing
- **PKD Validation**: Public Key Directory validation for document authentication

### Monitoring & Operations
- **Autonomous Monitoring**: Self-healing system with proactive maintenance
- **Health Checks**: Comprehensive system health monitoring and reporting
- **Error Tracking**: Advanced error detection and correlation
- **Performance Metrics**: Real-time system performance monitoring
- **Circuit Breakers**: Resilience patterns for external service failures

## External Dependencies

### Core Technologies
- **Node.js/Express**: Server runtime and web framework
- **PostgreSQL**: Primary database (with SQLite production fallback)
- **Redis**: Caching and session storage (optional)

### AI & Machine Learning
- **OpenAI API**: GPT-5 language model integration
- **Anthropic API**: Alternative AI provider (optional)

### Government Services
- **Datanamix**: Official DHA data partner for NPR/ABIS access
- **DHA APIs**: National Population Register and biometric services
- **SITA**: Government IT infrastructure integration

### Security & Compliance
- **PKI Infrastructure**: Government certificate authorities
- **HSM Integration**: Hardware Security Modules for key management
- **Audit Systems**: Government compliance reporting

### Cloud & Infrastructure
- **Netlify**: Primary deployment platform with Functions support
- **Replit**: Development environment support
- **GitHub**: Source code repository and CI/CD

### External APIs
- **Voice Services**: Speech processing capabilities
- **Document Services**: PDF generation and OCR processing
- **Verification Services**: Real-time government database validation

### Development Tools
- **Vite**: Frontend build tooling
- **TypeScript**: Type safety across the stack
- **Drizzle Kit**: Database migration and introspection tools
- **ESLint**: Code quality and consistency