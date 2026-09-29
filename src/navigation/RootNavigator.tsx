import React from 'react';
import { useAuth } from '../context/AuthContext';
import { CarpmLoader } from '../components/CarpmLoader';
import { AuthStack } from './AuthStack';
import { AppStack } from './AppStack';

export function RootNavigator() {
  const { session, loading } = useAuth();

  if (loading) {
    return <CarpmLoader screen label="CaRPM açılıyor…" />;
  }

  return session ? <AppStack /> : <AuthStack />;
}
