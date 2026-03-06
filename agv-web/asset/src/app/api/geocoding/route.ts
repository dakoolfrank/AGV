import { NextRequest, NextResponse } from 'next/server';
import { Client } from '@googlemaps/google-maps-services-js';

const client = new Client({});


export async function POST(request: NextRequest) {
  try {
    const { type, data } = await request.json();
    
    // Check if we have API keys configured
    const useGoogleMaps = process.env.GOOGLE_MAPS_API_KEY && 
                         process.env.GOOGLE_MAPS_API_KEY !== 'your_google_maps_api_key_here' &&
                         process.env.GOOGLE_MAPS_API_KEY.length > 10;
    const useOpenCage = process.env.OPENCAGE_API_KEY && 
                       process.env.OPENCAGE_API_KEY !== 'your_opencage_api_key_here' &&
                       process.env.OPENCAGE_API_KEY.length > 10;
    console.log({googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY});
    console.log({opencageApiKey: process.env.OPENCAGE_API_KEY});
    // If no APIs are configured, return a simple fallback response
    if (!useGoogleMaps && !useOpenCage) {
      if (type === 'reverse_geocode') {
        const { lat, lng } = data;
        return NextResponse.json({
          success: true,
          data: {
            latitude: lat,
            longitude: lng,
            county: '',
            city: '',
            province: '',
            address: `Coordinates: ${parseFloat(lat).toFixed(6)}, ${parseFloat(lng).toFixed(6)}`
          }
        });
      }else {
        return NextResponse.json(
          { error: 'No geocoding API keys configured. Please set GOOGLE_MAPS_API_KEY or OPENCAGE_API_KEY' },
          { status: 500 }
        );
      }
    }

    if (type === 'geocode') {
      // Forward geocoding: address to coordinates
      const { address } = data;
      
      if (useGoogleMaps) {
        try {
            const response = await client.geocode({
              params: {
                address,
                key: process.env.GOOGLE_MAPS_API_KEY!,
              },
            });

          if (response.data.status === 'OK' && response.data.results.length > 0) {
            const result = response.data.results[0];
            const location = result.geometry.location;
            
            // Parse address components
            let county = '';
            let city = '';
            let province = '';
            
            result.address_components.forEach((component) => {
              const types = component.types;
              if (types.includes('administrative_area_level_3' as never)) {
                county = component.long_name;
              } else if (types.includes('administrative_area_level_2' as never)) {
                city = component.long_name;
              } else if (types.includes('administrative_area_level_1' as never)) {
                province = component.long_name;
              }
            });

            return NextResponse.json({
              success: true,
              data: {
                latitude: location.lat.toString(),
                longitude: location.lng.toString(),
                county,
                city,
                province,
                address: result.formatted_address
              }
            });
          } else {
            throw new Error(`Google Maps geocoding failed: ${response.data.status}`);
          }
        } catch (error) {
          console.error('Google Maps geocoding failed, trying OpenCage:', error);
          // Fall through to OpenCage if Google Maps fails
        }
      }
      
      // Use OpenCage as fallback or primary option
      if (useOpenCage) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
          
          const response = await fetch(
            `https://api.opencagedata.com/geocode/v1/json?q=${encodeURIComponent(address)}&key=${process.env.OPENCAGE_API_KEY}&limit=1`,
            { signal: controller.signal }
          );
          clearTimeout(timeoutId);
          
          if (!response.ok) {
            console.log({response});
            throw new Error(`OpenCage API error: ${response.status}`);
          }
          
          const data = await response.json();
          
          if (data.results && data.results.length > 0) {
            const result = data.results[0];
            const components = result.components;
            
            return NextResponse.json({
              success: true,
              data: {
                latitude: result.geometry.lat.toString(),
                longitude: result.geometry.lng.toString(),
                county: components.county || components.city_district || '',
                city: components.city || components.town || '',
                province: components.state || components.province || '',
                address: result.formatted
              }
            });
          }
        } catch (error) {
          console.error('OpenCage geocoding failed:', error);
        }
      }
      
      // If both APIs failed, try fallback search for the address
      console.log('Both APIs failed for geocoding, trying fallback search');
      
      return NextResponse.json(
        { error: 'Geocoding failed - no working API available' },
        { status: 400 }
      );
    } else if (type === 'reverse_geocode') {
      // Reverse geocoding: coordinates to address
      const { lat, lng } = data;
      
      if (useGoogleMaps) {
        try {
          const response = await client.reverseGeocode({
            params: {
              latlng: { lat: parseFloat(lat), lng: parseFloat(lng) },
                key: process.env.GOOGLE_MAPS_API_KEY!,
            },
          });

          if (response.data.status === 'OK' && response.data.results.length > 0) {
            const result = response.data.results[0];
            
            // Parse address components
            let county = '';
            let city = '';
            let province = '';
            
            result.address_components.forEach((component) => {
              const types = component.types;
              if (types.includes('administrative_area_level_3' as never)) {
                county = component.long_name;
              } else if (types.includes('administrative_area_level_2' as never)) {
                city = component.long_name;
              } else if (types.includes('administrative_area_level_1' as never)) {
                province = component.long_name;
              }
            });

            return NextResponse.json({
              success: true,
              data: {
                latitude: lat,
                longitude: lng,
                county,
                city,
                province,
                address: result.formatted_address
              }
            });
          } else {
            throw new Error(`Google Maps reverse geocoding failed: ${response.data.status}`);
          }
        } catch (error) {
          console.error('Google Maps reverse geocoding failed, trying OpenCage:', error);
          // Fall through to OpenCage if Google Maps fails
        }
      }
      
      // Use OpenCage as fallback or primary option
      if (useOpenCage) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000);
          
          const response = await fetch(
            `https://api.opencagedata.com/geocode/v1/json?q=${lat}+${lng}&key=${process.env.OPENCAGE_API_KEY}&limit=1`,
            { signal: controller.signal }
          );
          clearTimeout(timeoutId);
          
          if (!response.ok) {
            console.log({response});
            throw new Error(`OpenCage API error: ${response.status}`);
          }
          
          const data = await response.json();
          
          if (data.results && data.results.length > 0) {
            const result = data.results[0];
            const components = result.components;
            
            return NextResponse.json({
              success: true,
              data: {
                latitude: lat,
                longitude: lng,
                county: components.county || components.city_district || '',
                city: components.city || components.town || '',
                province: components.state || components.province || '',
                address: result.formatted
              }
            });
          }
        } catch (error) {
          console.error('OpenCage reverse geocoding failed:', error);
        }
      }
      
      // If both APIs failed, return coordinates with basic info
      console.log('Both APIs failed for reverse geocoding, using fallback');
      return NextResponse.json({
        success: true,
        data: {
          latitude: lat,
          longitude: lng,
          county: '',
          city: '',
          province: '',
          address: `Coordinates: ${parseFloat(lat).toFixed(6)}, ${parseFloat(lng).toFixed(6)}`
        }
      });
    } else if (type === 'search') {
      // Text search for places
      const { query } = data;
      
      if (useGoogleMaps) {
        try {
          const response = await client.textSearch({
            params: {
              query,
                key: process.env.GOOGLE_MAPS_API_KEY!,
            },
          });

          if (response.data.status === 'OK' && response.data.results.length > 0) {
            const results = response.data.results.map((result) => {
              const location = result.geometry?.location;
              
              // Parse address components
              let county = '';
              let city = '';
              let province = '';
              
              result.address_components?.forEach((component) => {
                const types = component.types;
                if (types.includes('administrative_area_level_3' as never)) {
                  county = component.long_name;
                } else if (types.includes('administrative_area_level_2' as never)) {
                  city = component.long_name;
                } else if (types.includes('administrative_area_level_1' as never)) {
                  province = component.long_name;
                }
              });

              return {
                formatted: result.formatted_address || result.name,
                geometry: {
                  lat: location?.lat || 0,
                  lng: location?.lng || 0
                },
                components: {
                  county,
                  city,
                  province
                }
              };
            });

            return NextResponse.json({
              success: true,
              data: results
            });
          } else {
            throw new Error(`Google Maps search failed: ${response.data.status}`);
          }
        } catch (error) {
          console.error('Google Maps search failed, trying OpenCage:', error);
          // Fall through to OpenCage if Google Maps fails
        }
      }
      
      // Use OpenCage as fallback or primary option
      if (useOpenCage) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000);
          
          const response = await fetch(
            `https://api.opencagedata.com/geocode/v1/json?q=${encodeURIComponent(query)}&key=${process.env.OPENCAGE_API_KEY}&limit=5`,
            { signal: controller.signal }
          );
          clearTimeout(timeoutId);
          
          if (!response.ok) {
            console.log({response});
            throw new Error(`OpenCage API error: ${response.status}`);
          }
          
          const data = await response.json();
          
          if (data.results && data.results.length > 0) {
            const results = data.results.map((result: {
              formatted: string;
              geometry: { lat: number; lng: number };
              components: Record<string, string>;
            }) => {
              const components = result.components;
              
              return {
                formatted: result.formatted,
                geometry: {
                  lat: result.geometry.lat,
                  lng: result.geometry.lng
                },
                components: {
                  county: components.county || components.city_district || '',
                  city: components.city || components.town || '',
                  province: components.state || components.province || ''
                }
              };
            });

            return NextResponse.json({
              success: true,
              data: results
            });
          }
        } catch (error) {
          console.error('OpenCage search failed:', error);
        }
      }
      
      // If both APIs failed, use fallback search results
      console.log('Both APIs failed, using fallback search results');
    } else {
      return NextResponse.json(
        { error: 'Invalid request type' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Geocoding API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
