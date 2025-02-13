import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import Layout from './components/Layout';
import AppRoutes from './routes';

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-background text-white">
        <Layout>
          <AppRoutes />
        </Layout>
      </div>
    </BrowserRouter>
  );
}

export default App;