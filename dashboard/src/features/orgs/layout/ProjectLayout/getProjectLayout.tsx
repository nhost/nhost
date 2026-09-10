import type { ComponentPropsWithoutRef, ReactElement, ReactNode } from 'react';
import { ProjectSectionLayout } from '@/components/layout/ProjectSectionLayout';
import ProjectLayout from './ProjectLayout';

export interface ProjectLayoutOptions {
  /**
   * Section navigation rendered at the top of the section (e.g. route tabs).
   */
  navigation?: ReactNode;
  /**
   * Optional section sub-sidebar rendered alongside the content.
   */
  sidebar?: ReactNode;
  navigationClassName?: string;
  bodyClassName?: string;
  contentClassName?: string;
  /**
   * Props forwarded to the `ProjectLayout` `<main>` container.
   */
  mainContainerProps?: ComponentPropsWithoutRef<'main'>;
  /**
   * Wraps the section body (navigation + sidebar + content) without adding a
   * layout box of its own. Use for context providers that must span both the
   * section sidebar and the content — e.g. a `contents`-classed Radix `Tabs`
   * root shared by a settings sidebar and its panels.
   */
  wrapper?: (body: ReactNode) => ReactElement;
}

/**
 * Builds a project page layout with `ProjectLayout` as the root element.
 *
 * Keeping `ProjectLayout` at the root of every project page's `getLayout` is
 * what lets React preserve the shared project shell (header, sidebar, project
 * state) across navigation instead of tearing it down and remounting it.
 * Section-specific chrome (route tabs, sub-sidebars, tab contexts) is always
 * contributed as children, never wrapped around `ProjectLayout`.
 */
export function getProjectLayout(
  page: ReactElement,
  options: ProjectLayoutOptions = {},
): ReactElement {
  const {
    navigation,
    sidebar,
    navigationClassName,
    bodyClassName,
    contentClassName,
    mainContainerProps,
    wrapper,
  } = options;

  if (!navigation && !sidebar) {
    return (
      <ProjectLayout mainContainerProps={mainContainerProps}>
        {page}
      </ProjectLayout>
    );
  }

  const body = (
    <ProjectSectionLayout
      navigation={navigation}
      sidebar={sidebar}
      navigationClassName={navigationClassName}
      bodyClassName={bodyClassName}
      contentClassName={contentClassName}
    >
      {page}
    </ProjectSectionLayout>
  );

  return (
    <ProjectLayout
      mainContainerProps={
        mainContainerProps ?? {
          className: 'flex h-full flex-col overflow-hidden',
        }
      }
    >
      {wrapper ? wrapper(body) : body}
    </ProjectLayout>
  );
}
