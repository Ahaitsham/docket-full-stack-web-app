import { createContext, useContext } from 'react';

export const SheetsCtx = createContext(null);
// open('task', { date }) opens a sheet, close() closes it, confirm({...}) resolves true/false.
export const useSheets = () => useContext(SheetsCtx);
