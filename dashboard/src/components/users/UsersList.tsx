import { UsersTable } from '@/components/applications/users/UsersTable';
import ErrorBoundaryFallback from '@/components/common/ErrorBoundaryFallback';
import { useState } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import UsersHeader from './UsersHeader';

export default function UsersList() {
  const [searchQuery, setSearchQuery] = useState('');
  const [totalNrOfPages, setTotalNrOfPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);

  return (
    <>
      <UsersHeader
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
        totalNrOfPages={totalNrOfPages}
      />

      <ErrorBoundary fallbackRender={ErrorBoundaryFallback}>
        <UsersTable
          searchQuery={searchQuery}
          currentPage={currentPage}
          setCurrentPage={setCurrentPage}
          totalNrOfPages={totalNrOfPages}
          setTotalNrOfPages={setTotalNrOfPages}
        />
      </ErrorBoundary>
    </>
  );
}
