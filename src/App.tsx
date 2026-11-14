import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { LocationProvider } from './context/LocationContext';
import { ThemeProvider } from './context/ThemeContext';
import { NotificationsProvider } from './context/NotificationsContext';
import { RequireAuth } from './components/RequireAuth';
import { Home } from './pages/Marketplace/Home';
import { Browse } from './pages/Marketplace/Browse';
import { ProductDetails } from './pages/Marketplace/ProductDetails';
import { Chat } from './pages/Marketplace/Chat';
import { Favorites } from './pages/Marketplace/Favorites';
import { Login } from './pages/Auth/Login';
import { Register } from './pages/Auth/Register';
import { VerifyAccount } from './pages/Auth/VerifyAccount';
import { CreateListing } from './pages/Marketplace/CreateListing';
import { MyListings } from './pages/Marketplace/MyListings';

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <AuthProvider>
        <NotificationsProvider>
          <LocationProvider>
            <Router>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/browse" element={<Browse />} />
                <Route path="/listings/:id" element={<ProductDetails />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/verify" element={<RequireAuth><VerifyAccount /></RequireAuth>} />
                <Route path="/chat" element={<RequireAuth><Chat /></RequireAuth>} />
                <Route path="/favorites" element={<RequireAuth><Favorites /></RequireAuth>} />
                <Route path="/my-listings" element={<RequireAuth><MyListings /></RequireAuth>} />
                <Route path="/create-listing" element={<RequireAuth verified><CreateListing /></RequireAuth>} />
              </Routes>
            </Router>
          </LocationProvider>
        </NotificationsProvider>
      </AuthProvider>
    </ThemeProvider>
  );
};
