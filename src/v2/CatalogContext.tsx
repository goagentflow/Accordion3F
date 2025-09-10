import React, { createContext, useContext, useState, useMemo } from 'react';

interface CatalogContextValue {
  csvRows: any[];
  setCsvRows: (rows: any[]) => void;
}

const CatalogContext = createContext<CatalogContextValue | undefined>(undefined);

export const CatalogProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [csvRows, setCsvRows] = useState<any[]>([]);
  const value = useMemo(() => ({ csvRows, setCsvRows }), [csvRows]);
  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
};

export const useCatalog = (): CatalogContextValue => {
  const ctx = useContext(CatalogContext);
  if (!ctx) throw new Error('useCatalog must be used within a CatalogProvider');
  return ctx;
};

export default CatalogProvider;

