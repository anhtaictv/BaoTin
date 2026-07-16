import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { AuthProvider } from './core/AuthContext';
import App from './App';

describe('App', () => {
  it('redirects an unauthenticated visitor to the login page', async () => {
    render(
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>,
    );

    expect(await screen.findByText('Báo Tin — Trung tâm điều hành')).toBeInTheDocument();
  });
});
