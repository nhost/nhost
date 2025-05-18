export type StorageGetter = (key: string) => string | null | Promise<string | null>;
export type StorageSetter = (key: string, value: string | null) => void | Promise<void>;
export interface ClientStorage {
    setItem?: (_key: string, _value: string) => void;
    getItem?: (key: string) => any;
    removeItem?: (key: string) => void;
    set?: (options: {
        key: string;
        value: string;
    }) => void;
    get?: (options: {
        key: string;
    }) => any;
    remove?: (options: {
        key: string;
    }) => void;
    setItemAsync?: (key: string, value: string) => void;
    getItemAsync?: (key: string) => any;
    deleteItemAsync?: (key: string) => void;
    customGet?: (key: string) => Promise<string | null> | string | null;
    customSet?: (key: string, value: string | null) => Promise<void> | void;
}
export type ClientStorageType = 'capacitor' | 'custom' | 'expo-secure-storage' | 'localStorage' | 'react-native' | 'web' | 'cookie';
//# sourceMappingURL=local-storage.d.ts.map