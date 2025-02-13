import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Dashboard from '../pages/Dashboard';
import Users from '../pages/Users';
import Teams from '../pages/Teams';
import SharePoint from '../pages/SharePoint';
import OneDrive from '../pages/OneDrive';
import Security from '../pages/Security';

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/users" element={<Users />} />
      <Route path="/teams" element={<Teams />} />
      <Route path="/sharepoint" element={<SharePoint />} />
      <Route path="/onedrive" element={<OneDrive />} />
      <Route path="/security" element={<Security />} />
    </Routes>
  );
};

export default AppRoutes