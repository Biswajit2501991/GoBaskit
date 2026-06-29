import { render, screen } from '@testing-library/react';
import ProductCard from '@/components/ProductCard/ProductCard';

jest.mock('@/store/cartStore', () => ({
  useCartStore: Object.assign(
    () => ({
      items: [],
      addItem: jest.fn(),
      updateQuantity: jest.fn(),
    }),
    {
      persist: {
        onFinishHydration: (cb: () => void) => {
          cb();
          return () => undefined;
        },
        hasHydrated: () => true,
      },
    }
  ),
}));

const mockProduct = {
  id: '1',
  name: 'Tomato',
  description: 'Fresh tomatoes',
  price: 45,
  unit: 'kg',
  stock: 10,
  status: 'ACTIVE',
  imageUrl: null,
  discount: 0,
  isFeatured: false,
  isVisible: true,
  categoryId: 'cat1',
  category: { id: 'cat1', name: 'Vegetables', slug: 'vegetables' },
};

describe('ProductCard', () => {
  it('renders product name and price', () => {
    render(<ProductCard product={mockProduct} />);
    expect(screen.getByText('Tomato')).toBeInTheDocument();
    expect(screen.getByText('ADD')).toBeInTheDocument();
  });
});
