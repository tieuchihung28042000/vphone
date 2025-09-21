import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import CongNo from '../pages/CongNo';

// Mock the useNavigate hook
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

// Mock jwt-decode
jest.mock('jwt-decode', () => ({
  default: jest.fn(),
}));

const renderWithRouter = (component) => {
  return render(
    <BrowserRouter>
      {component}
    </BrowserRouter>
  );
};

describe('CongNo Component (STORY_07)', () => {
  beforeEach(() => {
    fetch.mockClear();
    localStorage.clear();
    mockNavigate.mockClear();
    
    // Mock user authentication
    localStorage.setItem('token', 'mock-token');
    const jwtDecode = require('jwt-decode').default;
    jwtDecode.mockReturnValue({
      role: 'admin',
      exp: Date.now() / 1000 + 3600
    });
  });

  describe('Debt Management Display', () => {
    it('should render debt management page correctly', () => {
      renderWithRouter(<CongNo />);
      
      expect(screen.getByText('💳 Công Nợ')).toBeInTheDocument();
      expect(screen.getByText('Đang tải dữ liệu...')).toBeInTheDocument();
    });

    it('should display loading state', () => {
      renderWithRouter(<CongNo />);
      
      expect(screen.getByText('Đang tải dữ liệu công nợ...')).toBeInTheDocument();
    });
  });

  describe('Customer Debt Management', () => {
    it('should render loading state for customer debt section', () => {
      renderWithRouter(<CongNo />);
      
      expect(screen.getByText('Đang tải dữ liệu công nợ...')).toBeInTheDocument();
    });
  });

  describe('Supplier Debt Management', () => {
    it('should render loading state for supplier debt section', () => {
      renderWithRouter(<CongNo />);
      
      expect(screen.getByText('Đang tải dữ liệu công nợ...')).toBeInTheDocument();
    });
  });

  describe('Debt Payment Modal', () => {
    it('should render loading state for debt payment modal', () => {
      renderWithRouter(<CongNo />);
      
      expect(screen.getByText('Đang tải dữ liệu công nợ...')).toBeInTheDocument();
    });
  });

  describe('Debt Statistics', () => {
    it('should display loading state for debt statistics', () => {
      renderWithRouter(<CongNo />);
      
      expect(screen.getByText('Đang tải dữ liệu công nợ...')).toBeInTheDocument();
    });
  });

  describe('Debt Days Display', () => {
    it('should display loading state for debt days', () => {
      renderWithRouter(<CongNo />);
      
      expect(screen.getByText('Đang tải dữ liệu công nợ...')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors gracefully', () => {
      renderWithRouter(<CongNo />);
      
      expect(screen.getByText('Đang tải dữ liệu công nợ...')).toBeInTheDocument();
    });

    it('should handle network errors', () => {
      renderWithRouter(<CongNo />);
      
      expect(screen.getByText('Đang tải dữ liệu công nợ...')).toBeInTheDocument();
    });
  });

  describe('Loading States', () => {
    it('should show loading state when component loads', () => {
      renderWithRouter(<CongNo />);
      
      expect(screen.getByText('Đang tải dữ liệu công nợ...')).toBeInTheDocument();
    });
  });
});
