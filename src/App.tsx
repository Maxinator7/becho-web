import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { LocationProvider } from './context/LocationContext';
import { ThemeProvider } from './context/ThemeContext';
import { NotificationsProvider } from './context/NotificationsContext';
import { RequireAuth } from './components/RequireAuth';
import { Footer } from './components/Navbar';
import { Home } from './pages/Marketplace/Home';
import { Browse } from './pages/Marketplace/Browse';
import { ProductDetails } from './pages/Marketplace/ProductDetails';
import { Chat } from './pages/Marketplace/Chat';
import { Favorites } from './pages/Marketplace/Favorites';
import { Login } from './pages/Auth/Login';
import { Register } from './pages/Auth/Register';
import { VerifyAccount } from './pages/Auth/VerifyAccount';
import { ForgotPassword } from './pages/Auth/ForgotPassword';
import { Account } from './pages/Account/Account';
import { CreateListing } from './pages/Marketplace/CreateListing';
import { AdminRedirect, NotFound } from './pages/NotFound';
import { Privacy } from './pages/Privacy';
import { BetaBanner, BetaProvider, FeedbackFab, type PrivacyLink } from './feedback/Beta';

const privacyLink: PrivacyLink = (className, children, newTab) => (
  <Link to="/privacy" className={className} {...(newTab ? { target: '_blank', rel: 'noopener' } : {})}>{children}</Link>
);

/*
 * Screens whose own bottom bar or composer sits where the floating button would go. Feedback stays
 * reachable there via the banner, the Beta chip, the account menu and the footer.
 */
const NO_FAB = [/^\/chat/, /^\/create-listing/, /^\/listings\/[^/]+\/edit/];
/** Phones only: listing details (sticky action bar) and the auth screens (no tab bar). */
const NO_FAB_PHONE = [/^\/listings\/[^/]+$/, /^\/(login|register|forgot-password|verify)$/];

const MarketplaceFab: React.FC = () => {
  const { pathname } = useLocation();
  if (NO_FAB.some((r) => r.test(pathname))) return null;
  return <FeedbackFab phone={!NO_FAB_PHONE.some((r) => r.test(pathname))} />;
};

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <AuthProvider>
        <NotificationsProvider>
          <LocationProvider>
            <Router>
              <BetaProvider source="WEB" privacyLink={privacyLink}>
                <BetaBanner />
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/browse" element={<Browse />} />
                  <Route path="/listings/:id" element={<ProductDetails />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/register" element={<Register />} />
                  <Route path="/forgot-password" element={<ForgotPassword />} />
                  <Route path="/account" element={<RequireAuth><Account /></RequireAuth>} />
                  <Route path="/verify" element={<RequireAuth><VerifyAccount /></RequireAuth>} />
                  <Route path="/chat" element={<RequireAuth><Chat /></RequireAuth>} />
                  <Route path="/favorites" element={<RequireAuth><Favorites /></RequireAuth>} />
                  {/* My listings now lives on the account page; this opens it at the listings section. */}
                  <Route path="/my-listings" element={<RequireAuth><Account section="listings" /></RequireAuth>} />
                  <Route path="/create-listing" element={<RequireAuth verified><CreateListing /></RequireAuth>} />
                  <Route path="/listings/:id/edit" element={<RequireAuth verified><CreateListing /></RequireAuth>} />
                  <Route path="/privacy" element={<Privacy />} />
                  <Route path="/admin/*" element={<AdminRedirect />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
                <Footer />
                <MarketplaceFab />
              </BetaProvider>
            </Router>
          </LocationProvider>
        </NotificationsProvider>
      </AuthProvider>
    </ThemeProvider>
  );
};
