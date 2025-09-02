"use client";

import { type ReactNode, useState } from "react";

interface TabFormProps {
  passwordTabLabel?: string;
  magicTabLabel?: string;
  socialTabLabel?: string;
  webauthnTabLabel?: string;
  passwordTabContent: ReactNode;
  magicTabContent: ReactNode;
  socialTabContent?: ReactNode;
  webauthnTabContent?: ReactNode;
}

export default function TabForm({
  passwordTabLabel = "Email & Password",
  magicTabLabel = "Magic Link",
  socialTabLabel = "Social",
  webauthnTabLabel = "Security Key",
  passwordTabContent,
  magicTabContent,
  socialTabContent,
  webauthnTabContent,
}: TabFormProps) {
  const [activeTab, setActiveTab] = useState<
    "password" | "magic" | "social" | "webauthn"
  >("password");

  return (
    <div>
      <div className="tabs-container">
        <button
          className={`tab-button ${activeTab === "password" ? "tab-active" : ""}`}
          onClick={() => setActiveTab("password")}
          type="button"
        >
          {passwordTabLabel}
        </button>
        <button
          className={`tab-button ${activeTab === "magic" ? "tab-active" : ""}`}
          onClick={() => setActiveTab("magic")}
          type="button"
        >
          {magicTabLabel}
        </button>
        {socialTabContent && (
          <button
            className={`tab-button ${activeTab === "social" ? "tab-active" : ""}`}
            onClick={() => setActiveTab("social")}
            type="button"
          >
            {socialTabLabel}
          </button>
        )}
        {webauthnTabContent && (
          <button
            className={`tab-button ${activeTab === "webauthn" ? "tab-active" : ""}`}
            onClick={() => setActiveTab("webauthn")}
            type="button"
          >
            {webauthnTabLabel}
          </button>
        )}
      </div>

      <div className="tab-content">
        {activeTab === "password" && passwordTabContent}
        {activeTab === "magic" && magicTabContent}
        {activeTab === "social" && socialTabContent}
        {activeTab === "webauthn" && webauthnTabContent}
      </div>
    </div>
  );
}
