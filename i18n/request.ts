import { getRequestConfig } from 'next-intl/server';

export default getRequestConfig(async (params) => {
  const locale = params.locale ?? 'ar';
  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
