import { Search } from '@/components/dashboard/Search';
import Selector from '@/ui/Selector';
import { AddUser } from './AddUser';

type UsersHeaderProps = {
  searchQuery: string;
  setSearchQuery: Function;
  currentPage: number;
  setCurrentPage: Function;
  totalNrOfPages: number;
};

function SelectorAbstract({ selected, option }: any) {
  return (
    <div className="flex flex-row space-x-2 px-2">
      <span
        className={`${
          selected ? 'font-medium' : 'font-normal'
        } block cursor-pointer self-center truncate`}
      >
        {option.name}
      </span>
    </div>
  );
}

export default function UsersHeader({
  searchQuery,
  setSearchQuery,
  currentPage,
  setCurrentPage,
  totalNrOfPages,
}: UsersHeaderProps) {
  return (
    <div className="flex flex-row place-content-between px-5 py-2">
      <div className="flex flex-row">
        <div className="flex flex-row self-center">
          <Selector
            OptionsSelector={SelectorAbstract}
            options={Array.from({ length: totalNrOfPages }, (_, i) => {
              const page = (i + 1).toString();

              return {
                id: page,
                name: page,
                disabled: false,
              };
            })}
            value={{
              id: currentPage.toString(),
              name: currentPage.toString(),
              disabled: false,
            }}
            onChange={(v) => setCurrentPage(v.id)}
          />
        </div>
      </div>
      <div className="flex flex-row">
        <Search
          placeholder="Find user"
          value={searchQuery}
          onChange={(e) => {
            setCurrentPage(1);
            setSearchQuery(e.target.value);
          }}
          width="w-label"
        />
        <AddUser />
      </div>
    </div>
  );
}
