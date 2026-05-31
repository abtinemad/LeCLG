import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Landing from './pages/Landing';
import Chat from './pages/Chat';
import Admin from './pages/Admin';
import Carnet from './pages/Carnet';
import Climat from './pages/Climat';
import QuestCeQueCest from './pages/QuestCeQueCest';
import { GlobalNav } from './components/GlobalNav';

import { Toaster } from "@/components/ui/sonner";

export default function App() {
  return (
    <BrowserRouter>
      <GlobalNav />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/carnet" element={<Carnet />} />
        <Route path="/climat" element={<Climat />} />
        <Route path="/quest-ce-que-cest" element={<QuestCeQueCest />} />
      </Routes>
      <Toaster />
    </BrowserRouter>
  );
}