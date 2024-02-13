
// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import '@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol'; //Extension du Standard ERC721 permettant le suivi des NFT
import '@openzeppelin/contracts/utils/ReentrancyGuard.sol'; //Evite les attaques de ReetrancyGuard

contract MintNFT is ReentrancyGuard, ERC721Enumerable {

  uint256 public tokenCounter; //nombre nft minté
  uint256 public listingCounter; //nombre total d'encheres creer
  uint256 public listingTotal; //nombre total d'encheres en cours
  uint8 public constant STATUS_OPEN = 1; //etat d'echere (ouvert)
  uint8 public constant STATUS_DONE = 2;  //etat d'echere (fini)

  string private baseTokenURI; //le URI d'une collection de NFT
  uint256 public minAuctionIncrement = 10; //pourcentage minimum d'une offre sur une enchere
  struct Listing { //structure d'une enchère
    address seller;
    uint256 tokenId;
    uint256 price;
    uint256 netPrice;
    uint256 startAt;
    uint256 endAt; 
    uint8 status;
  }

  event Minted(address indexed minter, uint256 nftID, string uri); //Evenement  de creation d'un NFT
  event AuctionCreated(uint256 listingId, address indexed seller, uint256 price, uint256 tokenId, uint256 startAt, uint256 endAt); //Evenement de création d'enchère
  event BidCreated(uint256 listingId, address indexed bidder, uint256 bid); //Evenement de nouvelle offre sur une enchère
  event AuctionCompleted(uint256 listingId, address indexed seller, address indexed bidder, uint256 bid); //Evenement de cloturation d'echère
  event WithdrawBid(uint256 listingId, address indexed bidder, uint256 bid); //Evenement de récuperation d'actif d'un perdant

  mapping(uint256 => Listing) public listings; //stocke info sur chaque enchere avec son identifiant
  mapping(uint256 => mapping(address => uint256)) public bids; //sotkc les encheres de chaque utilisateurs pour une enchere
  mapping(uint256 => address) public highestBidder; //stocke le highestBidder pour chaque enchere
  mapping(uint256 => string) private _tokenURIs; //stocke le URI de chaque NFT
  mapping(string => bool) private _usedURIs; //stocke les URI des NFT appartenant à des utilisateurs ne pouvant pas être réutiliser

  constructor(string memory _name, string memory _symbol) ERC721(_name, _symbol) { //fonction appelé à l'intialisation du contrat
    tokenCounter = 0;
    listingCounter = 0;
    listingTotal = 0;
  }
  //Fonction getter
  function tokenURI(uint256 tokenId) public view virtual override returns (string memory) {
      return _tokenURIs[tokenId];
  }
  function getCurrentPrice(uint256 listingId) public view returns (uint256) {
    address highestBidderAddress = highestBidder[listingId];
    return bids[listingId][highestBidderAddress];
  }
  function getHighestBidder(uint256 listingId) public view returns (address) {
    return highestBidder[listingId];
  }
  function getTotalAuction() public view returns (uint256 _numb){
    return listingCounter;
  }
  function getTotalAuctionInProgress() public view returns (uint256 _numb){
    return listingTotal;
  }
  function getDetailsListing(uint x) public view returns (Listing memory _Listing){
    return listings[x];
  }
  function getBidAmountByUser(uint256 listingId, address user) public view returns (uint256) {
    return bids[listingId][user];
  }
  function _baseURI() internal view override returns (string memory) {
    return baseTokenURI;
  }
  //Permet de créer un NFT via lien vers un fichier json
  function mint(address minterAddress, string memory uri) public returns (uint256) {
    require(!_usedURIs[uri], "URI already used");
    tokenCounter++;
    uint256 tokenId = tokenCounter;
    _safeMint(minterAddress, tokenId);
    _tokenURIs[tokenId] = uri;
    emit Minted(minterAddress, tokenId, _baseURI());
    _usedURIs[uri] = true;
    return tokenId;
  }
  //Permet de vendre un NFT déjà existant sur le réseau
  function sellExistingNFT(uint256 tokenId, uint256 price, uint256 durationInSeconds)  public returns (uint256) {
    require(ownerOf(tokenId) == msg.sender, "Vous n'etes pas le proprietaire de ce NFT");
     _usedURIs[_tokenURIs[tokenId]] = true;
    _transfer(msg.sender, address(this), tokenId);

    listingCounter++;
    listingTotal++;
    uint256 listingId = listingCounter;
    uint256 startAt = block.timestamp;
    uint256 endAt = startAt + durationInSeconds;

    listings[listingId] = Listing({
        seller: msg.sender,
        tokenId: tokenId,
        price: price,
        netPrice: price,
        status: STATUS_OPEN,
        startAt: startAt,
        endAt: endAt
    });

    emit AuctionCreated(listingId, msg.sender, price, tokenId, startAt, endAt);
    return listingId;
  }
  //Permet de créer une enchère
  function createAuctionListing (uint256 price, uint256 durationInSeconds, string memory uri) public returns (uint256) {
    uint256 tokenId = mint(msg.sender, uri);
    listingCounter++;
    listingTotal++;
    uint256 listingId = listingCounter;

    uint256 startAt = block.timestamp;
    uint256 endAt = startAt + durationInSeconds;

    listings[listingId] = Listing({
      seller: msg.sender,
      tokenId: tokenId,
      price: price,
      netPrice: price,
      status: STATUS_OPEN,
      startAt: startAt,
      endAt: endAt
    });
    _transfer(msg.sender, address(this), tokenId);
    emit AuctionCreated(listingId, msg.sender, price, tokenId, startAt, endAt);
    return listingId;
  }
  //Permet de participer à une enchère
  function bid(uint256 listingId) public payable nonReentrant {
    require(isAuctionOpen(listingId), 'auction has ended');
    Listing storage listing = listings[listingId];
    require(msg.sender != listing.seller, "cannot bid on what you own");
    uint256 newBid = bids[listingId][msg.sender] + msg.value;
    require(newBid >= listing.price, "cannot bid below the latest bidding price");
    bids[listingId][msg.sender] += msg.value;
    highestBidder[listingId] = msg.sender;
    uint256 incentive = listing.price / minAuctionIncrement;
    listing.price = listing.price + incentive;
    emit BidCreated(listingId, msg.sender, newBid);
  }
  //Permet de cloturer une enchère
  function completeAuction(uint256 listingId) public payable nonReentrant {
    require(isAuctionExpired(listingId), 'auction is not explired');
    Listing storage listing = listings[listingId];
    address winner = highestBidder[listingId]; 
    require(msg.sender == listing.seller || msg.sender == winner, 'only seller or winner can complete auction');
    if(winner != address(0)) {
      _transfer(address(this), winner, listing.tokenId);
      uint256 amount = bids[listingId][winner]; 
      bids[listingId][winner] = 0;
      _transferFund(payable(listing.seller), amount);
    } else {
      _transfer(address(this), listing.seller, listing.tokenId);
    }
    listing.status = STATUS_DONE;
    listingTotal--;
    emit AuctionCompleted(listingId, listing.seller, winner, bids[listingId][winner]);
  }
  //Permet de recuperer ses fonds si perdant 
  function withdrawBid(uint256 listingId) public payable nonReentrant { 
    require(isAuctionExpired(listingId), 'auction must be ended');
    require(highestBidder[listingId] != msg.sender, 'highest bidder cannot withdraw bid');
    uint256 balance = bids[listingId][msg.sender];
    bids[listingId][msg.sender] = 0;
    _transferFund(payable(msg.sender), balance);
    emit WithdrawBid(listingId, msg.sender, balance);
  }

  //Verifie si l'enchère n'est pas cloturé
  function isAuctionOpen(uint256 id) public view returns (bool) { 
    return listings[id].status == STATUS_OPEN;
  }
  //Verifie si le temps d'une enchere est ecoulé
  function isAuctionExpired(uint256 id) public view returns (bool) { 
    return listings[id].endAt <= block.timestamp;
  }
  //Permet de transferer des fonds
  function _transferFund(address payable to, uint256 amount) internal {
    if (amount == 0) {
        return;
      }
    require(to != address(0), 'Error, cannot transfer to address(0)');
    (bool transferSent, ) = to.call{value: amount}("");
    require(transferSent, "Error, failed to send Ether");
  }

}