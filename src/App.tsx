import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { Home } from './pages/Marketplace/Home';
import { Browse } from './pages/Marketplace/Browse';
import { ProductDetails } from './pages/Marketplace/ProductDetails';
import { Chat } from './pages/Marketplace/Chat';
import { Favorites } from './pages/Marketplace/Favorites';
import { AdminDashboard } from './pages/Admin/Dashboard';
import { Login } from './pages/Auth/Login';
import { Register } from './pages/Auth/Register';
import { CreateListing } from './pages/Marketplace/CreateListing';
import { MyListings } from './pages/Marketplace/MyListings';

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/browse" element={<Browse />} />
          <Route path="/listings/:id" element={<ProductDetails />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/favorites" element={<Favorites />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/create-listing" element={<CreateListing />} />
          <Route path="/my-listings" element={<MyListings />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
};
