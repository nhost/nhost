/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
import React from 'react';

import Link from '@docusaurus/Link';
// import { PageMetadata } from '@docusaurus/theme-common';
import Translate, { translate } from '@docusaurus/Translate';
import Layout from '@theme/Layout';
export default function NotFound() {
  return (
    <>
      {/* <PageMetadata
        title={translate({
          id: 'theme.NotFound.title',
          message: 'Page Not Found!!!',
        })}
      /> */}
      <Layout>
        <main className="container margin-vert--xl">
          <div className="row">
            <div
              className="col col--6 col--offset-3"
              style={{ textAlign: 'center' }}
            >
              <h1 className="hero__title">
                <Translate
                  id="theme.NotFound.title"
                  description="The title of the 404 page"
                >
                  Page Not Found
                </Translate>
              </h1>
              <p>
                <Translate
                  id="theme.NotFound.p1"
                  description="The first paragraph of the 404 page"
                >
                  We could not find what you were looking for.
                </Translate>
              </p>
              <a
                href={'/'}
                className="home-link"
                style={{
                  display: 'block',
                  marginLeft: 'auto',
                  marginRight: 'auto',
                  width: '40%',
                }}
              >
                <Translate
                  id="theme.NotFound.home"
                  description="The text of the go to home page button"
                >
                  Go to Home Page
                </Translate>
              </a>
            </div>
          </div>
        </main>
      </Layout>
    </>
  );
}
