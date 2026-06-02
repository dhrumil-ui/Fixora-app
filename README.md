# Fixora — Home Services SaaS Platform

A full-stack, production-ready SaaS platform connecting homeowners with trusted service providers.

🌐 **Live Demo:** [fixora.guru](https://fixora.guru)

---

## About The Project

Fixora is a SaaS web application that connects homeowners with skilled service providers. Built with the MERN stack, real-time communication via Socket.io, and containerized with Docker. The platform handles everything from booking management to payments and live notifications.

---

## Features

- JWT Authentication for customers, providers, and admins
- Booking system — create, update, and cancel bookings in real-time
- Live chat powered by Socket.io
- Google Maps integration for location-based provider search
- Reviews and ratings system
- Admin dashboard with live feed of bookings and users
- Email notifications via Gmail and SendGrid
- Fully Dockerized for dev and production

---

## Tech Stack

**Frontend**
- React + TypeScript
- Vite
- Tailwind CSS

**Backend**
- Node.js + Express.js
- MongoDB + Mongoose
- Socket.io
- JWT Authentication

**DevOps**
- Docker + Docker Compose
- Nginx (reverse proxy)

---

## Project Structure

```
Fixora-app/
├── backend/               # Node.js + Express REST API
│   └── src/
│       ├── controllers/
│       ├── models/
│       └── routes/
├── frontend/              # React + TypeScript + Vite
│   └── src/
│       ├── components/
│       └── pages/
├── nginx/                 # Reverse proxy config
├── docker-compose.yml     # Production
└── docker-compose.dev.yml # Development
```

---

## Architecture

```
Client (React + Vite)
        │
        ▼
   Nginx (Reverse Proxy)
        │
        ├──► Express REST API (:5001)
        │         │
        │         ├──► MongoDB
        │         └──► Socket.io (real-time)
        │
        └──► Static Frontend Build
```

---

## Getting Started

**1. Clone the repo**
```bash
git clone https://github.com/dhrumil-ui/Fixora-app.git
cd Fixora-app
```

**2. Set up environment variables**
```bash
cp .env.example .env
```

**3. Start with Docker**
```bash
make dev
```

**4. Open in browser**
```
Frontend: http://localhost:5173
Backend:  http://localhost:5001
```

---

## Live

🌐 [https://fixora.guru](https://fixora.guru)

---

Made by Dhrumil
