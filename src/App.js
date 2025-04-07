import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import Footer from './components/Footer';
import Home from './pages/Home';
import About from './pages/About';
import MLModel from './pages/MLModel';
import Algorithms from './pages/Algorithms';
import './App.css';

function App() {
  return (
    <Router>
      <div className="app-wrapper d-flex flex-column min-vh-100">
        <Header />
        <main className="flex-grow-1">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/about" element={<About />} />
            <Route path="/ml" element={<MLModel />} />
            <Route path="/algorithms" element={<Algorithms />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </Router>
  );
}

export default App;

