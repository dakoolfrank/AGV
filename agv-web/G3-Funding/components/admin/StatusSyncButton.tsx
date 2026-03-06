'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

interface SyncResult {
  type: 'contributor' | 'institutional';
  appId: string;
  kolId: string;
  displayName: string;
  email: string;
  status: 'fixed' | 'error';
  error?: string;
}

interface SyncResponse {
  success: boolean;
  message: string;
  summary: {
    totalProcessed: number;
    fixed: number;
    errors: number;
  };
  results: SyncResult[];
}

export function StatusSyncButton() {
  const [isRunning, setIsRunning] = useState(false);
  const [lastResult, setLastResult] = useState<SyncResponse | null>(null);

  const runStatusSync = async () => {
    try {
      setIsRunning(true);
      setLastResult(null);

      const response = await fetch('/api/admin/fix-kol-status-sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();
      setLastResult(result);

      if (result.success) {
        toast.success(`Status sync completed! Fixed ${result.summary.fixed} profiles`);
      } else {
        toast.error('Status sync failed: ' + result.error);
      }
    } catch (error) {
      console.error('Error running status sync:', error);
      toast.error('Failed to run status sync');
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <RefreshCw className="h-5 w-5" />
          <span>KOL Status Synchronization</span>
        </CardTitle>
        <CardDescription>
          Fix any approved applications where KOL profiles still show as pending
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button 
          onClick={runStatusSync}
          disabled={isRunning}
          className="w-full"
        >
          {isRunning ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Running Sync...
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4 mr-2" />
              Fix Status Synchronization
            </>
          )}
        </Button>

        {lastResult && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Total Processed:</span>
              <Badge variant="outline">{lastResult.summary.totalProcessed}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-green-600">Fixed:</span>
              <Badge className="bg-green-100 text-green-800">
                <CheckCircle className="h-3 w-3 mr-1" />
                {lastResult.summary.fixed}
              </Badge>
            </div>
            {lastResult.summary.errors > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-red-600">Errors:</span>
                <Badge className="bg-red-100 text-red-800">
                  <XCircle className="h-3 w-3 mr-1" />
                  {lastResult.summary.errors}
                </Badge>
              </div>
            )}

            {lastResult.results.length > 0 && (
              <div className="mt-4">
                <h4 className="text-sm font-medium mb-2">Results:</h4>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {lastResult.results.map((result, index) => (
                    <div key={index} className="flex items-center justify-between text-xs p-2 bg-gray-50 rounded">
                      <div className="flex-1">
                        <span className="font-medium">{result.displayName}</span>
                        <span className="text-gray-500 ml-2">({result.email})</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge 
                          className={result.status === 'fixed' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}
                        >
                          {result.status === 'fixed' ? (
                            <CheckCircle className="h-3 w-3 mr-1" />
                          ) : (
                            <XCircle className="h-3 w-3 mr-1" />
                          )}
                          {result.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
