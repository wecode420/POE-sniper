/* jshint node: true */
/* jshint jquery: true */
/* jshint esversion: 6 */
"use strict";

/**
 * Filter class
 *
 * Filter representation
 * @params Nothing
 * @return Filter object
 */

var async    = require( "async" );
var mu       = require( "mu2" );
var fs       = require( "fs" );
const {app}  = require( "electron" ).remote;
const path   = require( "path" );
mu.root      = __dirname + '/templates';
var config   = {};
// Check if config.json exists in app data, otherwise create it from default
// config file.
console.log( "Loading config from " + app.getPath( "userData" ) + path.sep + "config.json" );
config = require( app.getPath( "userData" ) + path.sep + "config.json" );

var Item      = require( "./item.js" );
var Currency  = require( "./currency.js" );
var itemTypes = require( "./itemTypes.json" );

class Filter {

    constructor( obj ) {
        var rangeReg = /([0-9.]+)\s*\-\s*([0-9.]+)/;
        this.league       = obj.league;
        this.item         = obj.item;
        this.title        = obj.title;
        this.budget       = obj.budget;
        this.currency     = obj.currency;
        this.links        = obj.links;
        this.socketsTotal = obj.socketsTotal;
        this.socketsRed   = obj.socketsRed;
        this.socketsGreen = obj.socketsGreen;
        this.socketsBlue  = obj.socketsBlue;
        this.socketsWhite = obj.socketsWhite;
        this.id           = obj.id;
        this.corrupted    = obj.corrupted;
        this.crafted      = obj.crafted;
        this.enchanted    = obj.enchanted;
        this.identified   = obj.identified;
        this.level        = obj.level;
        this.tier         = obj.tier;
        this.experience   = obj.experience;
        this.quality      = obj.quality;
        this.rarity       = obj.rarity;
        this.armor        = obj.armor;  
        this.es           = obj.es;   
        this.evasion      = obj.evasion; 
        this.dps          = obj.dps;
        this.pdps         = obj.pdps;
        this.edps         = obj.edps;
        this.affixes      = obj.affixes;
        this.affixesDis   = obj.affixesDis;
        this.buyout       = obj.buyout;
        this.clipboard    = obj.clipboard;
        this.itemType     = obj.itemType;
        this.title        = obj.title;
        this.active       = obj.active;
        this.checked      = obj.active ? "checked" : "";
        this.convert      = obj.convert;
        this.displayPrice = obj.displayPrice === undefined ? "" : obj.displayPrice;
        this.openPrefixes = obj.openPrefixes === undefined ? "" : obj.openPrefixes;
        this.openSuffixes = obj.openSuffixes === undefined ? "" : obj.openSuffixes;
        this.mapQuantity  = obj.mapQuantity === undefined ? "" : obj.mapQuantity;
        this.mapRarity    = obj.mapRarity === undefined ? "" : obj.mapRarity;
        this.mapPackSize  = obj.mapPackSize === undefined ? "" : obj.mapPackSize;
        // Convert affixes without type to explicit to ensure compatibility
        // with older versions
        var extractReg = /^\(([a-zA-Z ]+)\)\s*/;
        for ( var affix in this.affixes ) {
            var match = extractReg.exec( affix );
            if ( !match ) {
                if ( this.affixes[affix][0] === 0 || this.affixes[affix][0] === "" ) {
                    this.affixes[affix][0] = "…";
                }
                if ( this.affixes[affix][1] === 1000000 || this.affixes[affix][1] === "" ) {
                    this.affixes[affix][1] = "…";
                }
                this.affixes["(Explicit) " + affix] = this.affixes[affix];
                delete this.affixes[affix];
            }
        }
        var self = this;
        var newAffixesDis = [];
        async.each( this.affixesDis, function( affixDis, cbAffix ) {
            var match = extractReg.exec( affixDis );
            if ( !match ) {
                var bothTerms        = /\( ([0-9.]+) \- ([0-9.]+) \)/;
                var missingLeftTerm  = /\(  \- ([0-9.]+) \)/;
                var missingRightTerm = /\( ([0-9.]+) \-  \)/;
                var matchBoth  = bothTerms.exec( affixDis );
                var matchLeft  = missingLeftTerm.exec( affixDis );
                var matchRight = missingRightTerm.exec( affixDis );
                if ( matchBoth ) {
                    affixDis = affixDis.replace( bothTerms, "( <span class='value'>$1</span> - <span class='value'>$2</span> )" );
                    newAffixesDis.push( "(Explicit) " + affixDis );
                } else if ( matchLeft ) {
                    affixDis = affixDis.replace( missingLeftTerm, "( <span class='value'>…</span> - <span class='value'>$1</span> )" );
                    newAffixesDis.push( "(Explicit) " + affixDis );
                } else if ( matchRight ) {
                    affixDis = affixDis.replace( missingRightTerm, "( <span class='value'>$1</span> - <span class='value'>…</span> )" );
                    newAffixesDis.push( "(Explicit) " + affixDis );
                }
                cbAffix();
            } else {
                newAffixesDis.push( affixDis );
                cbAffix();
            }
        }, function() {
            self.affixesDis = newAffixesDis;
        });
    }

    /**
     * Render the filter to html using a template
     *
     * @params Callback
     * @return Generated HTML through callback
     */
    render( callback ) {
        var generated = "";
        mu.compileAndRender( "filter.html", this )
        .on( "data", function ( data ) {
            generated += data.toString();
        })
        .on( "end", function() {
            callback( generated );
        });
    }

    /**
     * Compare mods from item and filter
     *
     * @params Item to compare, callback
     * @return Boolean through callback
     */
    compareMods( parsedMods, callback ) {
        var passed = 0;
        var keys   = 0;
        // Compare mod values to filter
        for ( var affix in this.affixes ) {
            if ( this.affixes.hasOwnProperty( affix )) {
                keys++;
                if ( isNaN( this.affixes[affix][0])) {
                    this.affixes[affix][0] = this.affixes[affix][0].replace( /.*>(.+)<.*/, "$1" );
                }
                if ( isNaN( this.affixes[affix][1])) {
                    this.affixes[affix][1] = this.affixes[affix][1].replace( /.*>(.+)<.*/, "$1" );
                }
                // If there is no lower value
                this.affixes[affix][0] = this.affixes[affix][0] !== "…" ? this.affixes[affix][0] : 0;
                // If there is no upper value
                this.affixes[affix][1] = this.affixes[affix][1] !== "…" ? this.affixes[affix][1] : 1000000;

                // If mod has one parameter
                if ( parsedMods.mods[affix] && parsedMods.mods[affix].length === 1 ) {
                    if ( parsedMods.mods[affix] && 
                        this.affixes[affix][0] <= parsedMods.mods[affix][0] &&
                        this.affixes[affix][1] >= parsedMods.mods[affix][0]) {
                        passed++;
                    }
                // If mod has two
                } else if ( parsedMods.mods[affix] && parsedMods.mods[affix].length === 2 ) {
                    var average = ( parsedMods.mods[affix][0] + parsedMods.mods[affix][1]) / 2;
                    if ( parsedMods.mods[affix] &&
                        this.affixes[affix][0] <= average &&
                        this.affixes[affix][1] >= average ) {
                        passed++;
                    }
                // Otherwise
                } else if ( parsedMods.mods[affix]) {
                    // console.log( parsedMods.mods[affix]);
                    passed++;
                }
            }
        }
        // console.log( "keys: " + keys + ", passed: " + passed );
        callback( passed === keys );
    }

    /**
     * Compare properties from item and filter
     *
     * @params Item to compare, callback
     * @return Boolean through callback
     */
    compareProperties( item, parsedProperties, callback ) {
        var self = this;

        // If:
        // ( no evasion filter OR filter evasion <= item evasion ) AND
        // ... ES ...
        // ... Armor ...
        // ... DPS ...
        // ... Quality ...
        // ( no tier filter OR ( item tier is a map tier AND both tiers are equal ) 
        //  OR ( item tier is a talisman tier AND both tiers are equal )) AND
        // ( item is not a gem OR no level filter OR ( item is a gem AND filter level <= gem level ))
        if (( this.evasion === "" || parseInt( this.evasion ) <= parseInt( parsedProperties["Evasion Rating"])) &&
            ( this.es      === "" || parseInt( this.es )      <= parseInt( parsedProperties["Energy Shield"])) && 
            ( this.armor   === "" || parseInt( this.armor )   <= parseInt( parsedProperties.Armour )) &&
            ( this.dps     === "" || parseFloat( this.dps )   <= parseFloat( parsedProperties.DPS )) &&
            ( this.pdps    === "" || parseFloat( this.pdps )  <= parseFloat( parsedProperties.pDPS )) &&
            ( this.edps    === "" || parseFloat( this.edps )  <= parseFloat( parsedProperties.eDPS )) &&
            ( this.mapPackSize === "" || parseFloat( this.mapPackSize ) <= parseFloat( parsedProperties["Monster Pack Size"])) &&
            ( this.mapQuantity === "" || parseFloat( this.mapQuantity ) <= parseFloat( parsedProperties["Item Quantity"])) &&
            ( this.mapRarity === "" || parseFloat( this.mapRarity ) <= parseFloat( parsedProperties["Item Rarity"])) &&
            ( this.quality   === "" || parsedProperties.Quality !== undefined &&
            parseInt( this.quality ) <= parseInt( parsedProperties.Quality.replace( /[\+\%]/g, "" ))) &&
            ( this.tier   === "" || ( parsedProperties["Map Tier"] !== undefined && (
            parseInt( this.tier ) === parseInt( parsedProperties["Map Tier"]) || 
            parseInt( this.tier ) === item.talismanTier ))) &&
            ( this.experience === "" || parseFloat( this.experience ) <= parseFloat( parsedProperties.Experience )) &&
            ( item.frameType !== 4 || this.level  === "" || (
                item.frameType === 4 && parsedProperties.Level !== undefined &&
                parseInt( this.level ) <= parseInt( parsedProperties.Level )))) {
            // Check the amount of links
            Item.getLinksAmountAndColor( item, function( res ) {
                item.linkAmount = res.linkAmount;
                // If there is no link filter or item links >= filter links
                // console.log( "filter-links: " + self.links + ", item-links: " + res.linkAmount );
                callback(
                    (( self.links === "0" && res.linkAmount < 5 ) || ( self.links !== "0" && self.links !== "45" && res.linkAmount === parseInt( self.links )) || self.links === "any" || ( self.links === "45" && res.linkAmount < 6 )) && 
                    ( self.socketsRed   === "" || ( res.colorCount.S >= parseInt( self.socketsRed )))   &&
                    ( self.socketsGreen === "" || ( res.colorCount.D >= parseInt( self.socketsGreen ))) &&
                    ( self.socketsBlue  === "" || ( res.colorCount.I >= parseInt( self.socketsBlue )))  &&
                    ( self.socketsWhite === "" || ( res.colorCount.G >= parseInt( self.socketsWhite )))
                );
            });
        } else {
            callback( false );
        }
    }

    /**
     * Check if item match the filter
     *
     * @params Item to check against, currency rates, callback
     * @return Boolean through callback
     */
    check( item, currencyRates, callback ) {
        var self = this;
        if ( this.currency === "chaos" ) {
            this.currency = "Chaos Orb";
        } else if  ( this.currency === "exa" ) {
            this.currency = "Exalted Orb";
        }
        // Clean up the item name and typeLine
        item.name     = item.name.replace( "<<set:MS>><<set:M>><<set:S>>", "" );
        item.typeLine = item.typeLine.replace( "<<set:MS>><<set:M>><<set:S>>", "" );
        var itemName  = item.name.replace( "<<set:MS>><<set:M>><<set:S>>", "" );
        var typeLine  = item.typeLine.replace( "<<set:MS>><<set:M>><<set:S>>", "" );
        var name      = itemName;
        // If item name is empty, the name is the type instead
        if ( itemName === "" ) {
            name = typeLine;
        }
        var league = this.league;
        if ( config.useBeta ) {
            league = "beta-" + league;
        }
        var itemLC = this.item.toLowerCase();

        // If: 
        // ( no names filter OR names are the same OR the typeLines are the same ) AND
        // ( no leagues filter OR leagues are the same ) AND
        // ( no socket amount filter OR socket amounts are the same ) AND
        // ( both are corrupted OR no corrupted state filter ) AND
        // ... enchanted ...
        // ... crafted ...
        // ... identified ...
        // ( no level filter OR item is a gem OR ( item is not a gem AND filter level <= item level )) AND
        // ( no rarity filter OR rarities are the same ) AND
        // ( no item type filter OR item types are the same )
        if (( this.league  === "any" || item.league === this.league ) &&
            ( this.item    === ""    || itemName.toLowerCase() === itemLC || 
              typeLine.toLowerCase() === itemLC ) &&
            ( this.itemType === "any" || this.itemType === "" || itemTypes[this.itemType].types.indexOf( item.typeLine ) !== -1 ) &&
            ( this.socketsTotal === ""    || this.socketsTotal <= item.sockets.length ) && 
            ( this.corrupted   === "any" || ( this.corrupted  == 'true' ) === item.corrupted ) &&
            ( this.enchanted   === "any" || ( this.enchanted  == 'true' ) === item.enchanted ) &&
            ( this.crafted     === "any" || ( this.crafted    == 'true' ) === item.crafted   ) &&
            ( this.identified  === "any" || ( this.identified == 'true' ) === item.identified ) &&
            ( this.level === "" || item.frameType === 4 || ( item.frameType !== 4 && this.level <= item.ilvl )) && 
            ( this.rarity === "any" || this.rarity == item.frameType || ( this.rarity === "not-unique" && item.frameType !== 3 && item.frameType !== 9 ))
            ) {

            var prices = Item.computePrice( item, currencyRates );
            
            // Convert filter price to chaos and check if the item is within budget
            if ( !this.budget || ( this.convert && prices.convertedPrice && 
                  prices.convertedPriceChaos <= this.budget * currencyRates[league][this.currency]) || 
                ( !prices.convertedPrice && !this.buyout ) || 
                ( !this.convert && this.currency === Currency.shortToLongLookupTable[prices.originalCurrency] && prices.originalAmount <= this.budget )) {

                // Parse item mods
                Item.parseMods( item, function( parsedMods ) {
                    // if ( Object.keys( parsedMods["mods"] ). length > 0 ) {
                    //     console.log( JSON.stringify( parsedMods ));
                    // }

                    // item.totalMods = parsedMods.totalMods;
                    // console.log( parsedMods.totalMods );
                    var keptTotalMods = [];
                    for ( var mod in parsedMods.totalMods ) {
                        if ( parsedMods.totalMods.hasOwnProperty( mod )) {
                            if ( self.affixes[mod]) {
                                keptTotalMods.push( mod.replace( /^\([a-zA-Z ]+\)\s*/, "" ).replace( "#", parsedMods.totalMods[mod]));
                            }
                        }
                    }
                    item.totalMods = keptTotalMods;
                    var keptPseudoMods = [];
                    for ( var mod in parsedMods.pseudoMods ) {
                        // console.log( self.affixes );
                        if ( parsedMods.pseudoMods.hasOwnProperty( mod )) {
                            if ( self.affixes[mod]) {
                                // console.log( "Found affix: " + mod );
                                keptPseudoMods.push( mod.replace( /^\([a-zA-Z ]+\)\s*/, "" ).replace( "#", parsedMods.pseudoMods[mod]));
                            }
                        }
                    }
                    item.pseudoMods = keptPseudoMods;
                    // console.log( item );
                    // Compare mods
                    self.compareMods( parsedMods, function( passed ) {
                        if ( passed ) {
                            Item.parseProperties( item, function( newItem, parsedProperties ) {
                                // console.log( newItem );
                                // If we have an attack per second property, compute DPS
                                if ( parsedProperties["Attacks per Second"]) {
                                    Item.computeDPS( parsedProperties, function( dps ) {
                                        parsedProperties.DPS  = dps.DPS;
                                        parsedProperties.pDPS = dps.pDPS;
                                        parsedProperties.eDPS = dps.eDPS;
                                        Item.insertDPSValues( newItem, dps, function( item ) {
                                            // console.log( "Inserted DPS value for item " + name );
                                            // Compare properties
                                            self.compareProperties( item, parsedProperties, function( equal ) {
                                                if ( equal ) {
                                                    Item.formatItem( item, name, prices, self.openPrefixes, self.openSuffixes, function( newItem ) {
                                                        if ( newItem.passed ) {
                                                            callback( newItem );
                                                        } else {
                                                            callback( false );
                                                        }
                                                    });
                                                // Item does not have the required properties
                                                } else {
                                                    // fs.appendFileSync( __dirname + "/log.txt", name + " (" + typeLine + "): Not the right properties\n" );
                                                    callback( false );
                                                }
                                            });
                                        });
                                    });
                                } else {
                                    // Compare properties
                                    self.compareProperties( newItem, parsedProperties, function( equal ) {
                                        // console.log( newItem );
                                        if ( equal ) {
                                            Item.formatItem( newItem, name, prices, self.openPrefixes, self.openSuffixes, function( newItem ) {
                                                if ( newItem.passed ) {
                                                    callback( newItem );
                                                } else {
                                                    callback( false );
                                                }
                                            });
                                        // Item does not have the required properties
                                        } else {
                                            // fs.appendFileSync( __dirname + "/log.txt", name + " (" + typeLine + "): Not the right properties\n" );
                                            callback( false );
                                        }
                                    });
                                }
                            });
                        // Item does not have the required mods
                        } else {
                            // fs.appendFileSync( __dirname + "/log.txt", name + " (" + typeLine + "): Not the right mods\n" );
                            // console.log( "Item didn't have sufficient mods" );
                            callback( false );
                        }
                    });
                });
            // Item is not within the budget
            } else {
                // fs.appendFileSync( __dirname + "/log.txt", name + " (" + typeLine + "): Not within budget\n" );
                // console.log( currencyRates[league] );
                // console.log( prices.convertedPriceChaos + " > " + this.budget + " * " + currencyRates[league][this.currency] + ", " + league + ", " + this.currency );
                callback( false );
            }
        // Item does not match the first tests
        } else {
            // fs.appendFileSync( __dirname + "/log.txt", name + " (" + typeLine + "): Failed first tests\n" );
            callback( false );
        }
    }

}

module.exports = Filter;