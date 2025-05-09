import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import Footer from './components/Footer';
import Home from './pages/Home';
import About from './pages/About';
import MLModel from './pages/MLModel';
import Algorithm from './pages/Algorithm';
import './App.css';

function App() {
  return (
    <BrowserRouter basename="/LearnFromUs">
      <div className="app-wrapper d-flex flex-column min-vh-100">
        <Header />
        <main className="flex-grow-1">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/about" element={<About />} />
            <Route path="/ml" element={<MLModel />} />
            <Route path="/algorithm" element={<Algorithm />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </BrowserRouter>
  );
}

export default App;

