import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/solid";
import classNames from "classnames";
import { Link } from "react-router-dom";

type BreadcrumbsProps = {
  backLink: string;
  breadcrumbs: Breadcrumb[];
};

type Breadcrumb = {
  link: string;
  text: string;
};

export function Breadcrumbs(props: BreadcrumbsProps) {
  const { backLink, breadcrumbs } = props;

  return (
    <div>
      <nav className="sm:hidden" aria-label="Back">
        <Link
          to={backLink}
          className="flex items-center text-sm font-medium text-gray-500 hover:text-gray-700"
        >
          <ChevronLeftIcon
            className="flex-shrink-0 w-5 h-5 mr-1 -ml-1 text-gray-400"
            aria-hidden="true"
          />
          Back
        </Link>
      </nav>
      <nav className="hidden sm:flex" aria-label="Breadcrumb">
        <ol className="flex items-center space-x-4">
          {breadcrumbs.map((breadcrumb, i) => {
            const isFirstItem = i === 0;
            const classes = classNames(
              "text-sm font-medium text-gray-500 hover:text-gray-700",
              {
                "ml-4": !isFirstItem,
              }
            );

            return (
              <li key={i}>
                <div className="flex items-center">
                  {!isFirstItem && (
                    <ChevronRightIcon
                      className="flex-shrink-0 w-5 h-5 text-gray-400"
                      aria-hidden="true"
                    />
                  )}
                  <Link to={breadcrumb.link} className={classes}>
                    {breadcrumb.text}
                  </Link>
                </div>
              </li>
            );
          })}
        </ol>
      </nav>
    </div>
  );
}
