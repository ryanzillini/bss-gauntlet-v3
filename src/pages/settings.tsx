import React, { useState } from 'react';
import MainLayout from '../components/layout/MainLayout';

interface SettingsForm {
  apiKey: string;
  webhookUrl: string;
  notifications: boolean;
  theme: 'light' | 'dark' | 'system';
}

const SettingsPage = () => {
  const [settings, setSettings] = useState<SettingsForm>({
    apiKey: '',
    webhookUrl: '',
    notifications: true,
    theme: 'system',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Settings updated:', settings);
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    setSettings((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto">
        <div className="mb-space-xl">
          <h1 className="text-3xl font-display font-bold mb-4">
            <span className="bg-gradient-to-r from-totogi-purple to-totogi-blue text-transparent bg-clip-text">
              Settings
            </span>
          </h1>
          <p className="text-pure-white/70 text-lg">
            Configure your BSS Magic instance and manage your preferences.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-space-xl">
          {/* API Configuration */}
          <div className="glass-card p-space-lg">
            <h2 className="text-xl font-display font-semibold text-pure-white mb-6">
              API Configuration
            </h2>
            <div className="space-y-space-lg">
              <div>
                <label
                  htmlFor="apiKey"
                  className="block text-sm font-medium text-pure-white/90 mb-2"
                >
                  API Key
                </label>
                <input
                  type="password"
                  id="apiKey"
                  name="apiKey"
                  value={settings.apiKey}
                  onChange={handleChange}
                  className="w-full px-4 py-2 bg-totogi-navy/50 border border-totogi-purple/20 rounded-lg 
                           text-pure-white placeholder-pure-white/30 focus:border-totogi-purple focus:ring-1 
                           focus:ring-totogi-purple"
                  placeholder="Enter your API key"
                />
              </div>

              <div>
                <label
                  htmlFor="webhookUrl"
                  className="block text-sm font-medium text-pure-white/90 mb-2"
                >
                  Webhook URL
                </label>
                <input
                  type="url"
                  id="webhookUrl"
                  name="webhookUrl"
                  value={settings.webhookUrl}
                  onChange={handleChange}
                  className="w-full px-4 py-2 bg-totogi-navy/50 border border-totogi-purple/20 rounded-lg 
                           text-pure-white placeholder-pure-white/30 focus:border-totogi-purple focus:ring-1 
                           focus:ring-totogi-purple"
                  placeholder="https://your-webhook.com/endpoint"
                />
              </div>
            </div>
          </div>

          {/* Preferences */}
          <div className="glass-card p-space-lg">
            <h2 className="text-xl font-display font-semibold text-pure-white mb-6">
              Preferences
            </h2>
            <div className="space-y-space-lg">
              <div>
                <label
                  htmlFor="theme"
                  className="block text-sm font-medium text-pure-white/90 mb-2"
                >
                  Theme
                </label>
                <select
                  id="theme"
                  name="theme"
                  value={settings.theme}
                  onChange={handleChange}
                  className="w-full px-4 py-2 bg-totogi-navy/50 border border-totogi-purple/20 rounded-lg 
                           text-pure-white focus:border-totogi-purple focus:ring-1 focus:ring-totogi-purple"
                >
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                  <option value="system">System</option>
                </select>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="notifications"
                  name="notifications"
                  checked={settings.notifications}
                  onChange={handleChange}
                  className="h-4 w-4 rounded border-totogi-purple/20 bg-totogi-navy/50 
                           text-totogi-purple focus:ring-totogi-purple"
                />
                <label
                  htmlFor="notifications"
                  className="ml-2 block text-sm text-pure-white/90"
                >
                  Enable notifications
                </label>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button type="submit" className="btn-primary">
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </MainLayout>
  );
};

export default SettingsPage; 