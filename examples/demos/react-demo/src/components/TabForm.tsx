import { type JSX, type ReactNode, useState } from "react";

interface TabFormProps {
  passwordTabContent: ReactNode;
  magicTabContent: ReactNode;
  socialTabContent?: ReactNode;
  webauthnTabContent?: ReactNode;
}

export default function TabForm({
  passwordTabContent,
  magicTabContent,
  socialTabContent,
  webauthnTabContent,
}: TabFormProps): JSX.Element {
  const [activeTab, setActiveTab] = useState<
    "password" | "magic" | "social" | "webauthn"
  >("password");

  return (
    <div>
      <div className="tabs-container">
        <button
          type="button"
          className={`tab-button ${activeTab === "password" ? "tab-active" : ""}`}
          onClick={() => setActiveTab("password")}
        >
          Email + Password
        </button>
        <button
          type="button"
          className={`tab-button ${activeTab === "magic" ? "tab-active" : ""}`}
          onClick={() => setActiveTab("magic")}
        >
          Magic Link
        </button>
        {socialTabContent && (
          <button
            type="button"
            className={`tab-button ${activeTab === "social" ? "tab-active" : ""}`}
            onClick={() => setActiveTab("social")}
          >
            Social
          </button>
        )}
        {webauthnTabContent && (
          <button
            type="button"
            className={`tab-button ${activeTab === "webauthn" ? "tab-active" : ""}`}
            onClick={() => setActiveTab("webauthn")}
          >
            Security Key
          </button>
        )}
      </div>

      <div className="tab-content">
        {activeTab === "password"
          ? passwordTabContent
          : activeTab === "magic"
            ? magicTabContent
            : activeTab === "social"
              ? socialTabContent
              : webauthnTabContent}
      </div>
    </div>
  );
}
