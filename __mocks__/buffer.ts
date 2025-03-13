export const Buffer = {
    from: jest.fn().mockImplementation((data) => {
      // Simple mock implementation that returns a basic buffer-like object
      const mockBuffer = Buffer.from('mock buffer');
      return mockBuffer;
    }),
  };