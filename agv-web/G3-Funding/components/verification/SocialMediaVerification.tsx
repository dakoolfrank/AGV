import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Loader2, 
  ExternalLink,
  RefreshCw,
  Shield,
  Clock
} from 'lucide-react';
import { 
  VerificationResult, 
  SocialMediaProfile 
} from '@/lib/social-media-verification';
import { isApiConfigured, getAvailableVerificationMethods } from '@/lib/verification-config';

interface SocialMediaVerificationProps {
  platform: string;
  url: string;
  username: string;
  result?: VerificationResult;
  isVerifying: boolean;
  onVerify: () => void;
  onRetry: () => void;
  verifiedProfile?: SocialMediaProfile;
}

export const SocialMediaVerification: React.FC<SocialMediaVerificationProps> = ({
  platform,
  url,
  username,
  result,
  isVerifying,
  onVerify,
  onRetry,
  verifiedProfile
}) => {
  const getStatusIcon = () => {
    if (isVerifying) {
      return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
    }
    
    if (!result) {
      return <Shield className="h-4 w-4 text-gray-400" />;
    }
    
    if (result.isValid) {
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    }
    
    if (result.verificationMethod === 'manual') {
      return <Clock className="h-4 w-4 text-yellow-500" />;
    }
    
    return <XCircle className="h-4 w-4 text-red-500" />;
  };

  const getStatusBadge = () => {
    if (isVerifying) {
      return <Badge variant="outline" className="text-blue-600 border-blue-200">Verifying...</Badge>;
    }
    
    if (!result) {
      return <Badge variant="outline" className="text-gray-600 border-gray-200">Not Verified</Badge>;
    }
    
    if (result.isValid) {
      return <Badge className="bg-green-100 text-green-800 border-green-200">✓ Verified</Badge>;
    }
    
    if (result.verificationMethod === 'manual') {
      return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">⏳ Manual Required</Badge>;
    }
    
    return <Badge className="bg-red-100 text-red-800 border-red-200">✗ Failed</Badge>;
  };

  const getVerificationMethodInfo = () => {
    const availableMethods = getAvailableVerificationMethods(platform);
    const hasApiAccess = isApiConfigured(platform);
    
    return {
      hasApiAccess,
      availableMethods,
      primaryMethod: hasApiAccess ? 'API' : 'Manual'
    };
  };

  const methodInfo = getVerificationMethodInfo();

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {getStatusIcon()}
            <CardTitle className="text-sm font-medium">
              {platform.charAt(0).toUpperCase() + platform.slice(1)} Verification
            </CardTitle>
            {getStatusBadge()}
          </div>
          <div className="flex items-center space-x-2">
            {result && !result.isValid && result.verificationMethod !== 'manual' && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onRetry}
                disabled={isVerifying}
                className="text-xs"
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                Retry
              </Button>
            )}
            {!result && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onVerify}
                disabled={isVerifying}
                className="text-xs"
              >
                {isVerifying ? (
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                ) : (
                  <Shield className="h-3 w-3 mr-1" />
                )}
                Verify
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-3">
        {/* Channel Info */}
        <div className="flex items-center justify-between text-sm">
          <div>
            <span className="font-medium">@{username}</span>
            <a 
              href={url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="ml-2 text-blue-600 hover:text-blue-800 inline-flex items-center"
            >
              <ExternalLink className="h-3 w-3 mr-1" />
              View Profile
            </a>
          </div>
          <div className="text-xs text-gray-500">
            Method: {methodInfo.primaryMethod}
          </div>
        </div>

        {/* Verification Result */}
        {result && (
          <div className="space-y-2">
            {/* Success State */}
            {result.isValid && verifiedProfile && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center space-x-2 mb-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium text-green-800">Verification Successful</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-green-700">
                  <div>Followers: {verifiedProfile.followers.toLocaleString()}</div>
                  {verifiedProfile.posts && <div>Posts: {verifiedProfile.posts.toLocaleString()}</div>}
                  {verifiedProfile.verified && <div>✓ Verified Account</div>}
                  <div>Method: {result.verificationMethod.toUpperCase()}</div>
                </div>
                {verifiedProfile.bio && (
                  <div className="mt-2 text-xs text-green-600 truncate">
                    "{verifiedProfile.bio}"
                  </div>
                )}
              </div>
            )}

            {/* Manual Verification Required */}
            {result.verificationMethod === 'manual' && (
              <Alert>
                <Clock className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-2">
                    <p className="font-medium">Manual Verification Required</p>
                    {result.warnings.map((warning, index) => (
                      <p key={index} className="text-sm">{warning}</p>
                    ))}
                    <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs">
                      <strong>Next Steps:</strong>
                      <ol className="mt-1 list-decimal list-inside space-y-1">
                        <li>Add the verification code to your profile</li>
                        <li>Our team will review within 24 hours</li>
                        <li>You'll receive an email confirmation</li>
                      </ol>
                    </div>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {/* Failed Verification */}
            {!result.isValid && result.verificationMethod === 'failed' && (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-2">
                    <p className="font-medium">Verification Failed</p>
                    {result.errors.map((error, index) => (
                      <p key={index} className="text-sm">{error}</p>
                    ))}
                    {!methodInfo.hasApiAccess && (
                      <p className="text-sm">
                        API access not configured for {platform}. Manual verification will be required.
                      </p>
                    )}
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {/* Warnings */}
            {result.warnings && result.warnings.length > 0 && result.isValid && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-1">
                    <p className="font-medium text-yellow-800">Verification Warnings</p>
                    {result.warnings.map((warning, index) => (
                      <p key={index} className="text-sm text-yellow-700">{warning}</p>
                    ))}
                  </div>
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {/* Verification Method Info */}
        {!result && (
          <div className="text-xs text-gray-500 space-y-1">
            <p>Available verification methods: {methodInfo.availableMethods.join(', ')}</p>
            {!methodInfo.hasApiAccess && (
              <p className="text-yellow-600">
                ⚠️ API not configured - manual verification will be required
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// Batch verification component
interface BatchVerificationProps {
  channels: Array<{ platform: string; url: string; username: string }>;
  verificationStates: Array<{
    result?: VerificationResult;
    isVerifying: boolean;
    verifiedProfile?: SocialMediaProfile;
  }>;
  onVerifyAll: () => void;
  onVerifyChannel: (index: number) => void;
  isVerifyingAll: boolean;
}

export const BatchVerification: React.FC<BatchVerificationProps> = ({
  channels,
  verificationStates,
  onVerifyAll,
  onVerifyChannel,
  isVerifyingAll
}) => {
  const verifiedCount = verificationStates.filter(state => state.result?.isValid).length;
  const totalCount = channels.length;
  const hasUnverifiedChannels = verificationStates.some(state => !state.result?.isValid);

  return (
    <div className="space-y-4">
      {/* Batch Actions */}
      <div className="flex items-center justify-between p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div>
          <h4 className="font-medium text-blue-800">Channel Verification</h4>
          <p className="text-sm text-blue-700">
            {verifiedCount} of {totalCount} channels verified
          </p>
        </div>
        <div className="flex items-center space-x-2">
          {hasUnverifiedChannels && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onVerifyAll}
              disabled={isVerifyingAll}
              className="border-blue-300 text-blue-700 hover:bg-blue-100"
            >
              {isVerifyingAll ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Shield className="h-4 w-4 mr-2" />
              )}
              Verify All Channels
            </Button>
          )}
        </div>
      </div>

      {/* Individual Channel Verifications */}
      <div className="space-y-3">
        {channels.map((channel, index) => (
          <SocialMediaVerification
            key={index}
            platform={channel.platform}
            url={channel.url}
            username={channel.username}
            result={verificationStates[index]?.result}
            isVerifying={verificationStates[index]?.isVerifying || false}
            verifiedProfile={verificationStates[index]?.verifiedProfile}
            onVerify={() => onVerifyChannel(index)}
            onRetry={() => onVerifyChannel(index)}
          />
        ))}
      </div>
    </div>
  );
};
