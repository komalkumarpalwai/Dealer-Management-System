import { LightningElement, track, api } from 'lwc';
import { loadScript, loadStyle } from 'lightning/platformResourceLoader';
import leaflet from '@salesforce/resourceUrl/leaflet';
import getDeliveryLocations from '@salesforce/apex/DeliveryLocationMapController.getDeliveryLocations';

export default class DeliveryLocationMap extends LightningElement {

    @api orderStatus;
    @api activatedDate;
    @api expectedDeliveryDate = null;
    @track isLoading = true;
    @track errorMessage = '';
    @track shippingAddress = '';
    @track billingAddress = '';
    @track accountName = '';
    @track deliveryInfo = null;

    leafletInitialized = false;
    map = null;

    /**
     * Check if order is activated
     */
    get isOrderActivated() {
        return this.orderStatus === 'Activated';
    }



    renderedCallback() {
        if (this.leafletInitialized) return;
        this.leafletInitialized = true;

        Promise.all([
            loadScript(this, leaflet + '/leaflet/leaflet.js'),
            loadStyle(this, leaflet + '/leaflet/leaflet.css')
        ])
        .then(() => this.fetchAndRenderMap())
        .catch(() => {
            this.isLoading = false;
            this.errorMessage = 'Failed to load map library. Please refresh the page.';
        });
    }

    fetchAndRenderMap() {
        getDeliveryLocations()
            .then(result => {
                this.isLoading = false;

                if (!result.success) {
                    this.errorMessage = result.message || 'Unable to load delivery location.';
                    return;
                }

                const shipLat = parseFloat(result.shippingLat);
                const shipLon = parseFloat(result.shippingLon);
                const billLat = parseFloat(result.billingLat);
                const billLon = parseFloat(result.billingLon);

                if (isNaN(shipLat) || isNaN(shipLon) || isNaN(billLat) || isNaN(billLon)) {
                    this.errorMessage = 'Received invalid coordinates from the server.';
                    return;
                }

                this.shippingAddress = result.shippingAddress;
                this.billingAddress  = result.billingAddress;
                this.accountName     = result.accountName;

                this.renderMap(billLat, billLon, shipLat, shipLon);
            })
            .catch(() => {
                this.isLoading = false;
                this.errorMessage = 'Error fetching location data. Please try again.';
            });
    }

    renderMap(billLat, billLon, shipLat, shipLon) {
        const container = this.template.querySelector('.map-container');
        if (!container) return;

        if (this.map) {
            this.map.remove();
            this.map = null;
        }

        // Center map between both points
        const centerLat = (billLat + shipLat) / 2;
        const centerLon = (billLon + shipLon) / 2;

        this.map = L.map(container, {
            scrollWheelZoom: false
        }).setView([centerLat, centerLon], 6);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 19
        }).addTo(this.map);

        // ── Billing Marker (Orange) ──
        const billingIcon = L.divIcon({
            className: '',
            html: `<div style="
                width:18px; height:18px; border-radius:50%;
                background:#e85d04; border:3px solid #ffffff;
                box-shadow:0 2px 8px rgba(232,93,4,0.6);">
            </div>`,
            iconSize: [18, 18],
            iconAnchor: [9, 9],
            popupAnchor: [0, -12]
        });

        L.marker([billLat, billLon], { icon: billingIcon })
            .addTo(this.map)
            .bindPopup(`
                <div style="min-width:200px; font-family:Arial,sans-serif; padding:4px;">
                    <div style="font-size:14px; font-weight:700; color:#e85d04; margin-bottom:6px;">
                        🏭 Billing / Origin
                    </div>
                    <div style="font-size:12px; color:#333; line-height:1.5;">
                        KRISH CARBON PVT LTD<br>${this.billingAddress}
                    </div>
                </div>
            `, { maxWidth: 260 });

        // ── Shipping Marker (Dark) ──
        const shippingIcon = L.divIcon({
            className: '',
            html: `<div style="
                background:#1a1a2e;
                width:32px; height:32px;
                border-radius:50% 50% 50% 0;
                transform:rotate(-45deg);
                border:3px solid #ffffff;
                box-shadow:0 3px 10px rgba(0,0,0,0.35);">
            </div>`,
            iconSize: [32, 32],
            iconAnchor: [16, 32],
            popupAnchor: [0, -34]
        });

        L.marker([shipLat, shipLon], { icon: shippingIcon })
            .addTo(this.map)
            .bindPopup(`
                <div style="min-width:200px; font-family:Arial,sans-serif; padding:4px;">
                    <div style="font-size:14px; font-weight:700; color:#1a1a2e; margin-bottom:6px;">
                        📦 Shipping / Destination
                    </div>
                    <div style="font-size:12px; color:#333; line-height:1.5;">
                        ${this.accountName}<br>${this.shippingAddress}
                    </div>
                </div>
            `, { maxWidth: 260 });

        // ── Draw Route Line Between Both Points ──
        // Uses OSRM public routing API (no API key needed)
        const routeUrl =
            `https://router.project-osrm.org/route/v1/driving/` +
            `${billLon},${billLat};${shipLon},${shipLat}` +
            `?overview=full&geometries=geojson`;

        fetch(routeUrl)
            .then(res => res.json())
            .then(data => {
                if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
                    const routeGeoJson = data.routes[0].geometry;
                    const routeCoordinates = routeGeoJson.coordinates; // Array of [lon, lat] points

                    // Draw the route
                    const routeLine = L.geoJSON(routeGeoJson, {
                        style: {
                            color: '#e85d04',
                            weight: 4,
                            opacity: 0.8,
                            dashArray: '8, 4'
                        }
                    }).addTo(this.map);

                    // Fit map to show entire route
                    this.map.fitBounds(routeLine.getBounds(), { padding: [50, 50] });

                    // ── Animated Truck Marker ──
                    const truckIcon = L.divIcon({
                        className: 'truck-marker',
                        html: `<div style="
                            font-size:32px;
                            display:flex;
                            align-items:center;
                            justify-content:center;
                            width:100%;
                            height:100%;
                            transform-origin:center center;
                            transition:transform 0.1s ease-out;">
                            🚚
                        </div>`,
                        iconSize: [40, 40],
                        iconAnchor: [20, 20],
                        popupAnchor: [0, -20],
                        shadowUrl: null
                    });

                    const truckMarker = L.marker([billLat, billLon], { icon: truckIcon })
                        .addTo(this.map)
                        .bindPopup('📦 In Transit', { permanent: false, offset: L.point(0, -30) });

                    // Animate truck along route with better coordinates handling
                    this.animateTruckAlongRoute(truckMarker, routeCoordinates, 3000); // 3 second loop

                    // Show distance and duration
                    const distanceKm = (data.routes[0].distance / 1000).toFixed(1);
                    const durationHr = Math.floor(data.routes[0].duration / 3600);
                    const durationMin = Math.floor((data.routes[0].duration % 3600) / 60);

                    // Calculate delivery information
                    const distanceValue = parseFloat(distanceKm);
                    let transitDays;
                    if (distanceValue < 300) transitDays = 1;
                    else if (distanceValue < 600) transitDays = 2;
                    else if (distanceValue < 1000) transitDays = 3;
                    else if (distanceValue < 1500) transitDays = 4;
                    else transitDays = 5;

                    // Calculate dates using Order_Activated_Date__c as starting point
                    let activationDate;
                    if (this.activatedDate) {
                        activationDate = new Date(this.activatedDate);
                    } else {
                        const today = new Date();
                        activationDate = new Date(today);
                    }

                    // Stage 1: Processing & Packing = 1 day
                    const processingDays = 1;
                    const dispatchDate = new Date(activationDate);
                    dispatchDate.setDate(dispatchDate.getDate() + processingDays);

                    // Stage 2: Transit = based on distance
                    // Stage 3: Expected Delivery = Dispatch + Transit + 1 day buffer
                    const expectedDate = new Date(dispatchDate);
                    expectedDate.setDate(expectedDate.getDate() + transitDays + 1); // Transit Days + 1 day buffer

                    // Delivery Window
                    const earliestDate = new Date(expectedDate);
                    earliestDate.setDate(earliestDate.getDate()); // Same as expected (with buffer already included)

                    const latestDate = new Date(expectedDate);
                    latestDate.setDate(latestDate.getDate() + 1); // One more day buffer

                    // Store raw expectedDate for delayed check
                    // Store the expected date and dispatch event for parent
                    this.expectedDeliveryDate = new Date(expectedDate);
                    this.dispatchEvent(new CustomEvent('deliverydatecalculated', {
                        detail: { expectedDate: this.expectedDeliveryDate },
                        bubbles: true
                    }));

                    // Date formatter
                    const dateFormatter = (d) => d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

                    // Assign delivery info
                    this.deliveryInfo = {
                        distanceKm,
                        durationHr,
                        durationMin,
                        processingDays,
                        transitDays,
                        bufferDays: 1,
                        totalDays: processingDays + transitDays + 1,
                        activationDate: dateFormatter(activationDate),
                        dispatchDate: dateFormatter(dispatchDate),
                        expectedDate: dateFormatter(expectedDate),
                        earliestDate: dateFormatter(earliestDate),
                        latestDate: dateFormatter(latestDate)
                    };

                    const midLat = (billLat + shipLat) / 2;
                    const midLon = (billLon + shipLon) / 2;

                    L.popup({ closeButton: false, autoClose: false, closeOnClick: false })
                        .setLatLng([midLat, midLon])
                        .setContent(`
                            <div style="text-align:center; font-family:Arial,sans-serif; padding:4px 8px;">
                                <div style="font-size:13px; font-weight:700; color:#1a1a2e;">🚚 ${distanceKm} km</div>
                                <div style="font-size:11px; color:#666;">${durationHr}h ${durationMin}m drive</div>
                            </div>
                        `)
                        .openOn(this.map);

                } else {
                    // Fallback: draw straight dashed line if routing fails
                    this.drawFallbackLine(billLat, billLon, shipLat, shipLon);
                }
            })
            .catch(() => {
                // Fallback: draw straight dashed line if fetch fails
                this.drawFallbackLine(billLat, billLon, shipLat, shipLon);
            });
    }

    drawFallbackLine(billLat, billLon, shipLat, shipLon) {
        const line = L.polyline(
            [[billLat, billLon], [shipLat, shipLon]],
            { color: '#e85d04', weight: 3, dashArray: '10, 8', opacity: 0.7 }
        ).addTo(this.map);

        this.map.fitBounds(line.getBounds(), { padding: [60, 60] });
    }

    /**
     * Animate truck marker moving along the route coordinates
     * @param {L.Marker} truckMarker - The truck marker to animate
     * @param {Array} routeCoordinates - Array of [lon, lat] coordinates from route
     * @param {Number} duration - Total animation duration in milliseconds
     */
    animateTruckAlongRoute(truckMarker, routeCoordinates, duration) {
        if (!routeCoordinates || routeCoordinates.length === 0) {
            console.warn('No route coordinates available for truck animation');
            return;
        }

        let currentStep = 0;
        const totalSteps = routeCoordinates.length;
        const stepDuration = duration / totalSteps;

        const animateStep = () => {
            // Get current waypoint
            const currentCoord = routeCoordinates[currentStep];
            if (!currentCoord || currentCoord.length < 2) {
                currentStep++;
                if (currentStep >= totalSteps) {
                    currentStep = 0;
                }
                setTimeout(animateStep, stepDuration);
                return;
            }

            const [lon, lat] = currentCoord;

            // Update truck position on map
            truckMarker.setLatLng(L.latLng(lat, lon));

            // Calculate next position for rotation
            const nextStep = (currentStep + 1) % totalSteps;
            const nextCoord = routeCoordinates[nextStep];

            if (nextCoord && nextCoord.length >= 2) {
                const [nextLon, nextLat] = nextCoord;

                // Calculate angle for rotation
                const dLat = nextLat - lat;
                const dLon = nextLon - lon;
                const angle = Math.atan2(dLon, dLat) * (180 / Math.PI);

                // Find and update truck icon element with rotation
                setTimeout(() => {
                    const iconElements = document.querySelectorAll('.leaflet-marker-icon.truck-marker');
                    if (iconElements && iconElements.length > 0) {
                        const truckElement = iconElements[iconElements.length - 1];
                        if (truckElement) {
                            const innerDiv = truckElement.querySelector('div');
                            if (innerDiv) {
                                innerDiv.style.transform = `rotate(${angle}deg)`;
                            }
                        }
                    }
                }, 0);
            }

            currentStep++;
            if (currentStep >= totalSteps) {
                currentStep = 0;
            }

            // Schedule next step
            setTimeout(animateStep, stepDuration);
        };

        // Start animation
        console.log('🚚 Starting truck animation with ' + totalSteps + ' waypoints');
        animateStep();
    }
}