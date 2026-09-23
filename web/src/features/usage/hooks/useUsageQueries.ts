import { useEffect, useMemo, useState } from 'react';
import { usageApi } from '../../../api/usage-api';
import { useCloudQuery, type CloudQueryResult } from '../../../hooks/useCloudQuery';
import { mergeFacets } from '../record-utils';
import type { UsageAnalyticsResponse, UsageQueryParams, UsageRecordFacets, UsageRecordPage } from '../types';

export function useUsageAnalyticsQuery(params: UsageQueryParams, options: { poll?: boolean; enabled?: boolean } = {}): CloudQueryResult<UsageAnalyticsResponse> {
  const queryKey = useMemo(() => JSON.stringify(params), [params]);
  return useCloudQuery(() => usageApi.analytics(params), { ...options, queryKey });
}

export function useUsageRecordsQuery(params: UsageQueryParams, options: { enabled?: boolean; poll?: boolean } = {}): CloudQueryResult<UsageRecordPage> & { facets: UsageRecordFacets | null } {
  const queryKey = useMemo(() => JSON.stringify(params), [params]);
  const result = useCloudQuery(() => usageApi.records(params), { ...options, queryKey });
  const [facets, setFacets] = useState<UsageRecordFacets | null>(null);
  useEffect(() => {
    if (result.data?.facets) setFacets((previous) => mergeFacets(previous, result.data?.facets ?? null));
  }, [result.data]);
  return { ...result, facets };
}
