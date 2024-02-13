import "./App.css";
import { useState, useEffect } from "react";
import { ethers } from "ethers";
import MintNFT from "./artifacts/contracts/MintNFT.sol/MintNFT.json";
import logo from "./img/logo.png";

const MintNFTAddress = "0x1bE7F8DCf7F72e6b8b470e8C0ba211fF10F2FF8A";

function App() {
  const [state, setState] = useState({
    contract: null,
  });
  const [error, setError] = useState("");
  const [currentAccount, setCurrentAccount] = useState(null);
  const [auctions, setAuctions] = useState([]);
  const [price, setPrice] = useState("");
  const [duration, setDuration] = useState("");
  const [tokenURI, setTokenURI] = useState("");
  const [myNFTs, setMyNFTs] = useState([]);
  const [loadingNFTs, setLoadingNFTs] = useState(true);
  const [isCreatingAuction, setIsCreatingAuction] = useState(false);
  const [bidAmounts, setBidAmounts] = useState({});
  const [isBidding, setIsBidding] = useState(false);
  const [isClosingAuction, setIsClosingAuction] = useState(false);
  const [myParticipations, setMyParticipations] = useState([]);
  const [nftAuctionDetails, setNftAuctionDetails] = useState({});
  const [activeSection, setActiveSection] = useState("auctions");

  //connexion metamask + changement compte
  useEffect(() => {
    const connectWallet = async () => {
      try {
        const { ethereum } = window;
        if (ethereum) {
          await ethereum.request({
            method: "eth_requestAccounts",
          });
          const provider = new ethers.BrowserProvider(window.ethereum);
          const signer = await provider.getSigner();
          const address = await signer.getAddress();
          setCurrentAccount(address);
          console.log("add", currentAccount);
          const contract = new ethers.Contract(
            MintNFTAddress,
            MintNFT.abi,
            signer
          );
          setState({ contract });
        }
      } catch (error) {
        console.log(error);
      }
    };
    connectWallet();
    const { ethereum } = window;
    if (ethereum) {
      ethereum.on("accountsChanged", (accounts) => {
        window.location.reload();
      });
    }
    return () => {
      if (ethereum) {
        ethereum.removeListener("accountsChanged", () => {
          console.log("Listener pour accountsChanged supprimé");
        });
      }
    };
  }, []);
  useEffect(() => {
    if (!state.contract) return;
    const contract = state.contract;

    fetchAuctions(contract);
    fetchMyNFTs(contract);
    fetchMyParticipations(contract);
  }, [state.contract]);

  //event
  useEffect(() => {
    if (!state.contract) return;

    const contract = state.contract;

    const onMinted = (minter, nftID, uri) => {
      console.log("NFT Minted: ", minter, nftID, uri);
      fetchMyNFTs(contract);
    };

    const onAuctionCreated = (listingId, seller, price, tokenId, endAt) => {
      console.log(
        "Auction Created: ",
        listingId,
        seller,
        price,
        tokenId,
        endAt
      );

      fetchAuctions(contract);
    };
    const onBidCreated = (listingId, seller, price, tokenId, endAt) => {
      console.log("New bid:", listingId, seller, price, tokenId, endAt);
      fetchAuctions(contract);
      fetchMyParticipations(contract);
    };
    const onAuctionCompleted = (listingId, seller, bidder, bid) => {
      console.log("Auction completed:", listingId, seller, bidder, bid);
      fetchMyNFTs(contract);
      fetchAuctions(contract);
    };

    const onWithdrawBid = (listingId, bidder, bid) => {
      console.log(bidder, "get his MATIC back for the NFT ID :", listingId);
      fetchMyParticipations(contract);
    };

    contract.on("Minted", onMinted);
    contract.on("AuctionCreated", onAuctionCreated);
    contract.on("BidCreated", onBidCreated);
    contract.on("AuctionCompleted", onAuctionCompleted);
    contract.on("WithdrawBid", onWithdrawBid);

    return () => {
      contract.off("Minted", onMinted);
      contract.off("AuctionCreated", onAuctionCreated);
      contract.off("BidCreated", onBidCreated);
      contract.off("AuctionCompleted", onAuctionCompleted);
      contract.off("WithdrawBid", onWithdrawBid);
    };
  }, [state.contract]);

  //recuperation des participations aux encheres d'un utilisateurs
  const fetchMyParticipations = async (contract) => {
    const participations = [];
    const totalListings = await contract.getTotalAuction();

    for (let i = 1; i <= totalListings; i++) {
      const bidAmount = await contract.bids(i, currentAccount);
      if (bidAmount > 0) {
        const details = await contract.getDetailsListing(i);
        const highestBidder = await contract.getHighestBidder(i);
        const tokenURI = await contract.tokenURI(details[1]);
        const response = await fetch(`https://ipfs.io/ipfs/${tokenURI}`);
        const metadata = await response.json();
        const imageUrl = metadata.image.replace(
          /^ipfs:\/\/(.*)/,
          "https://ipfs.io/ipfs/$1"
        );
        const actualPrice = await contract.getBidAmountByUser(i, highestBidder);
        const participation = {
          listingId: i,
          seller: details[0],
          tokenId: details[1].toString(),
          price: ethers.formatEther(details[2]),
          endAt: new Date(Number(details[5]) * 1000).toLocaleString(),
          status: Number(details[6]),
          highestBidder,
          imageURI: imageUrl,
          bidAmount: bidAmount,
          actualPrice: actualPrice,
        };
        participations.push(participation);
      }
    }
    setMyParticipations(participations);
  };
  //recuperation des encheres en cours
  const fetchAuctions = async (contract) => {
    if (!contract) return;
    try {
      let activeAuctions = [];
      const totalListings = Number(await contract.getTotalAuction());
      console.log("Total Listings:", totalListings);

      // Parcourir toutes les enchères, pas seulement celles actives
      for (let i = totalListings; i >= 1; i--) {
        // Commencer à 1 et inclure totalListings
        const isOpen = await contract.isAuctionOpen(i);
        if (isOpen) {
          const details = await contract.getDetailsListing(i);
          const highestBidder = await contract.getHighestBidder(i);
          const actualPrice = await contract.getBidAmountByUser(
            i,
            highestBidder
          );
          const tokenURI = await contract.tokenURI(details[1]);
          const response = await fetch(`https://ipfs.io/ipfs/${tokenURI}`);
          const metadata = await response.json();
          const imageUrl = metadata.image.replace(
            /^ipfs:\/\/(.*)/,
            "https://ipfs.io/ipfs/$1"
          );
          const auction = {
            seller: details[0],
            tokenId: details[1].toString(),
            price: ethers.formatEther(details[2]),
            actualPrice: ethers.formatEther(actualPrice),
            endAt: new Date(Number(details[5]) * 1000).toLocaleString(),
            status: Number(details[6]),
            highestBidder,
            imageURI: imageUrl,
            id: i,
          };
          activeAuctions.push(auction);
        }
      }

      setAuctions(activeAuctions);
    } catch (err) {
      console.error("Error fetching auctions:", err);
    }
  };
  const fetchMyNFTs = async (contract) => {
    if (!contract || !currentAccount) return;
    setLoadingNFTs(true);
    console.log("wait");
    try {
      const nftCount = await state.contract.balanceOf(currentAccount);
      console.log("nft count,", nftCount);
      let ownedNFTs = [];

      for (let i = 0; i < nftCount; i++) {
        const tokenId = await state.contract.tokenOfOwnerByIndex(
          currentAccount,
          i
        );
        let tokenURI = await state.contract.tokenURI(tokenId);
        tokenURI = `https://ipfs.io/ipfs/${tokenURI}`;
        const response = await fetch(tokenURI);
        const metadata = await response.json();
        const imageUrl = metadata.image.replace(
          /^ipfs:\/\/(.*)/,
          "https://ipfs.io/ipfs/$1"
        );
        ownedNFTs.push({
          tokenId,
          name: metadata.name,
          description: metadata.description,
          imageUrl,
        });
      }

      setMyNFTs(ownedNFTs);
    } catch (error) {
      console.error("Error fetching my NFTs:", error);
    }
    setLoadingNFTs(false);
  };

  useEffect(() => {
    console.log("Les enchères mises à jour sont :", auctions);
    console.log("nft :", myNFTs);
  }, [auctions, myNFTs]);

  const createAuctions = async () => {
    if (!state.contract) {
      console.log("pas de contrat connecté");
      return;
    }
    try {
      const priceInWei = ethers.parseEther(price);
      const durationInSeconds = duration * 60;
      console.log("priiice :", priceInWei, "duuuuration :", durationInSeconds);
      console.log(
        "priiice 2 :",
        typeof priceInWei,
        "duuuuration 2 :",
        typeof durationInSeconds
      );
      const transaction = await state.contract.createAuctionListing(
        priceInWei,
        durationInSeconds,
        tokenURI
      );
      setIsCreatingAuction(true);
      await transaction.wait();
      setPrice("");
      setDuration("");
      setTokenURI("");
      console.log("Auction created successfully");
    } catch (err) {
      console.error("Error creating auction:", err);
      setError(err.message);
    } finally {
      setIsCreatingAuction(false);
      fetchAuctions(state.contract);
      fetchMyParticipations(state.contract);
      fetchMyNFTs(state.contract);
    }
  };
  const completeAuction = async (listingId) => {
    if (!state.contract) {
      console.log("Contract not connected");
      return;
    }

    try {
      const transaction = await state.contract.completeAuction(listingId);
      setIsClosingAuction(true);
      await transaction.wait();
      console.log(`Auction ${listingId} completed successfully`);
    } catch (error) {
      console.error("Error completing auction:", error);
      setError(error.message);
    } finally {
      fetchAuctions(state.contract);
      fetchMyParticipations(state.contract);
      setIsClosingAuction(false);
    }
  };
  const bid = async (listingId, bidAmount) => {
    if (!state.contract) {
      console.log("Contract not connected");
      return;
    }

    try {
      const bidAmountWei = ethers.parseEther(bidAmount.toString());
      const transaction = await state.contract.bid(listingId, {
        value: bidAmountWei,
      });
      console.log("Bidding in progress...");
      setIsBidding(true);
      await transaction.wait();
      console.log(
        `Bid successful for listing ${listingId} with amount ${bidAmount}`
      );
    } catch (error) {
      console.error("Error during bidding:", error);
      setError(error.message);
    } finally {
      fetchAuctions(state.contract);
      fetchMyParticipations(state.contract);
      setIsBidding(false);
    }
  };
  const handleAuctionDetailChange = (tokenId, field, value) => {
    setNftAuctionDetails({
      ...nftAuctionDetails,
      [tokenId]: {
        ...nftAuctionDetails[tokenId],
        [field]: value,
      },
    });
  };

  const sellNFT = async (tokenId) => {
    const details = nftAuctionDetails[tokenId];
    if (!details || !details.price || !details.duration) {
      console.error("Price or duration not set");
      return;
    }

    try {
      console.log("detaila price", details.price);
      console.log("dur", details.duration);
      const priceInWei = ethers.parseEther(details.price);
      const durationInSeconds = details.duration * 60;
      console.log(
        "nftprice :",
        priceInWei,
        "NFTPRICE  2:",
        typeof priceInWei,
        "nftdur :",
        durationInSeconds,
        "NFTDURATION 2 :",
        typeof durationInSeconds
      );
      const transaction = await state.contract.sellExistingNFT(
        tokenId,
        priceInWei,
        durationInSeconds
      );
      setIsCreatingAuction(true);
      await transaction.wait();
    } catch (error) {
      console.error("Failed to sell NFT:", error);
    } finally {
      fetchAuctions(state.contract);
      fetchMyParticipations(state.contract);
      fetchMyNFTs(state.contract);
      setIsCreatingAuction(false);
    }
  };
  const handlePriceChange = (event) => {
    setPrice(event.target.value);
  };

  const handleDurationChange = (event) => {
    setDuration(event.target.value);
  };
  const handleBidSubmit = async (listingId) => {
    const bidAmount = bidAmounts[listingId];
    if (bidAmount) {
      await bid(listingId, bidAmount);
      setBidAmounts((prevAmounts) => ({
        ...prevAmounts,
        [listingId]: "",
      }));
    }
  };
  const withdrawBid = async (listingId) => {
    if (!state.contract) {
      console.log("Contract not connected");
      return;
    }

    try {
      console.log("try to withdraw...", listingId);
      const transaction = await state.contract.withdrawBid(listingId);
      await transaction.wait();
      console.log(`Bid withdrawn successfully for listing ${listingId}`);
      fetchAuctions(state.contract);
      fetchMyParticipations(state.contract);
    } catch (error) {
      console.error("Error withdrawing bid:", error);
      setError(error.message);
    }
  };
  const handleBidAmountChange = (listingId, amount) => {
    setBidAmounts((prevAmounts) => ({
      ...prevAmounts,
      [listingId]: amount,
    }));
  };

  return (
    <div className="App">
      <nav className="navbar">
        <img src={logo} alt="logo" />
        <button onClick={() => setActiveSection("auctions")}>
          Enchères en cours
        </button>
        <button onClick={() => setActiveSection("myAuctions")}>
          Mes enchères
        </button>
        <button onClick={() => setActiveSection("myNFTs")}>Mes NFT</button>
        <button onClick={() => setActiveSection("myBids")}>
          Mes participations
        </button>
      </nav>
      {error && <p>{error}</p>}
      {isCreatingAuction && (
        <div className="loading-overlay">
          <div className="loading-message">
            <p>Création de l'enchère en cours...</p>
          </div>
        </div>
      )}
      {isBidding && (
        <div className="loading-overlay">
          <div className="loading-message">
            <p>Transaction en cours...</p>
          </div>
        </div>
      )}
      {isClosingAuction && (
        <div className="loading-overlay">
          <div className="loading-message">
            <p>Cloture de l'enchère en cours...</p>
          </div>
        </div>
      )}
      {activeSection === "myBids" && (
        <div className="my-bids-container">
          <div>
            <div className="my-participations-container">
              <h2>Mes participations</h2>
              {myParticipations.map((participation, index) => (
                <div key={index} className="card">
                  <img
                    src={participation.imageURI}
                    alt={`NFT ${participation.tokenId}`}
                    style={{ width: "100px", height: "100px" }}
                  />
                  <p>
                    <strong>ID de l'enchère :</strong> {participation.tokenId}
                  </p>
                  <p>
                    <strong>Vendeur :</strong>{" "}
                    <a
                      href={`https://mumbai.polygonscan.com/address/${participation.seller}`}
                    >
                      {"Voir le vendeur"}
                    </a>
                  </p>
                  <p>
                    <strong>Meilleur enchérisseur :</strong>{" "}
                    {participation.highestBidder.toLowerCase() ===
                    currentAccount.toLowerCase()
                      ? "Vous êtes le meilleur enchérisseur"
                      : participation.highestBidder ===
                        "0x0000000000000000000000000000000000000000"
                      ? "Personne"
                      : participation.highestBidder}
                  </p>
                  <p>
                    <strong>Prix minimum pour surenchérir: </strong>{" "}
                    {participation.price} MATIC
                  </p>
                  <p>
                    <strong>Prix en cours: </strong>
                    {""}
                    {participation.actualPrice} MATIC
                  </p>
                  <p>
                    <strong>Fin :</strong> {participation.endAt}
                  </p>
                  {participation.status === 1 && (
                    <>
                      <input
                        type="number"
                        value={bidAmounts[participation.tokenId] || ""}
                        onChange={(e) =>
                          handleBidAmountChange(
                            participation.tokenId,
                            e.target.value
                          )
                        }
                        placeholder="Votre enchère"
                        min={parseFloat(participation.bidAmount)}
                        step="0.01"
                      />
                      <button
                        onClick={() => handleBidSubmit(participation.tokenId)}
                      >
                        Enchérir
                      </button>
                    </>
                  )}
                  {participation.status !== 1 && (
                    <>
                      <p>Vous avez perdu cette enchère.</p>
                      <p>
                        <strong>Votre mise :</strong> {participation.bidAmount}{" "}
                        ETH
                      </p>
                      <button
                        onClick={() => withdrawBid(participation.listingId)}
                      >
                        Récupérer ma mise
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {activeSection === "auctions" && (
        <div className="auctions-container">
          <h2>Enchères en cours</h2>
          {auctions.map((auction, index) => (
            <div key={index} className="card">
              <img
                src={auction.imageURI}
                alt={`NFT ${auction.tokenId}`}
                style={{ width: "100px", height: "100px" }}
              />
              <div>
                <p>
                  <strong>ID de l'enchère :</strong> {auction.id}
                </p>
                <p>
                  <strong>Vendeur :</strong>{" "}
                  <a
                    href={`https://mumbai.polygonscan.com/address/${auction.seller}`}
                  >
                    {"Voir le vendeur"}
                  </a>
                </p>
                <p>
                  <strong>Meilleur enchérisseur :</strong>{" "}
                  {auction.highestBidder.toLowerCase() ===
                  currentAccount.toLowerCase() ? (
                    "Vous êtes le meilleur enchérisseur"
                  ) : auction.highestBidder ===
                    "0x0000000000000000000000000000000000000000" ? (
                    "Personne"
                  ) : (
                    <a
                      href={`https://mumbai.polygonscan.com/address/${auction.highestBidder}`}
                    >
                      {"Voir le compte"}
                    </a>
                  )}
                </p>
                <p>
                  <strong>Prix actuel de l'enchère:</strong>{" "}
                  {auction.actualPrice} MATIC
                </p>
                <p>
                  <strong>Prix minimum pour surenchérir: </strong>{" "}
                  {auction.price} MATIC
                </p>
                <p>
                  <strong>Fin :</strong> {auction.endAt}
                </p>
                <input
                  type="number"
                  value={bidAmounts[auction.tokenId] || ""}
                  onChange={(e) =>
                    handleBidAmountChange(auction.tokenId, e.target.value)
                  }
                  placeholder="Votre enchère"
                  min={parseFloat(auction.price)}
                  step="0.01"
                />
                <button onClick={() => handleBidSubmit(auction.id)}>
                  Enchérir
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {activeSection === "myAuctions" && (
        <div className="my-auctions-container">
          <h2>Mes mise aux Enchères</h2>
          <div className="create-auction-inputs">
            <input
              type="number"
              value={price}
              onChange={handlePriceChange}
              placeholder="Prix de départ en ETH"
              step="0.0001"
              min="0"
            />
            <input
              type="number"
              value={duration}
              onChange={handleDurationChange}
              placeholder="Durée en minutes"
              min="1"
            />
            <input
              type="text"
              value={tokenURI}
              onChange={(e) => setTokenURI(e.target.value)}
              placeholder="URI du NFT"
            />
            <button className="create" onClick={createAuctions}>
              Créer
            </button>
          </div>
          <ul>
            {auctions.filter(
              (auction) =>
                auction.seller.toLowerCase() === currentAccount.toLowerCase()
            ).length > 0 ? (
              <ul>
                {auctions
                  .filter(
                    (auction) =>
                      auction.seller.toLowerCase() ===
                      currentAccount.toLowerCase()
                  )
                  .map((auction, index) => (
                    <div key={index} className="card">
                      <img
                        src={auction.imageURI}
                        alt={`NFT ${auction.tokenId}`}
                        style={{ width: "100px", height: "100px" }}
                      />
                      <p>
                        <strong>ID de l'enchère :</strong> {auction.id}
                      </p>
                      <p>
                        <strong>Mise actuel: </strong> {auction.actualPrice}{" "}
                        MATIC
                      </p>
                      <p>
                        <strong>Fin :</strong> {auction.endAt}
                      </p>
                      <button
                        className="complete-auction"
                        onClick={() => completeAuction(auction.id)}
                      >
                        Finir l'enchère
                      </button>
                    </div>
                  ))}
              </ul>
            ) : (
              <p>Vous n'avez pas d'enchères actuellement.</p>
            )}
          </ul>
        </div>
      )}
      {activeSection === "myNFTs" && (
        <div id="my-nfts-container" className="my-nfts-container">
          <h2>Mes NFTs</h2>
          {loadingNFTs ? (
            <p>Chargement de vos NFTs...</p>
          ) : myNFTs.length > 0 ? (
            myNFTs.map((nft, index) => (
              <div key={index} className="card">
                <p>
                  <strong>ID du NFT :</strong> {nft.tokenId.toString()}
                </p>
                <p>
                  <strong>Nom :</strong> {nft.name}
                </p>
                <p>
                  <strong>Description :</strong> {nft.description}
                </p>
                <img
                  src={nft.imageUrl}
                  alt={`NFT ${nft.tokenId}`}
                  style={{ maxWidth: "200px", maxHeight: "200px" }}
                />
                <input
                  type="number"
                  placeholder="Prix de départ en MATIC"
                  onChange={(e) =>
                    handleAuctionDetailChange(
                      nft.tokenId,
                      "price",
                      e.target.value
                    )
                  }
                  step="0.0001"
                  min="0"
                />
                <input
                  type="number"
                  placeholder="Durée en minutes"
                  onChange={(e) =>
                    handleAuctionDetailChange(
                      nft.tokenId,
                      "duration",
                      e.target.value
                    )
                  }
                  min="1"
                />
                <button onClick={() => sellNFT(nft.tokenId)}>
                  Mettre en enchère
                </button>
              </div>
            ))
          ) : (
            <p>Vous ne possédez aucun NFT actuellement.</p>
          )}
        </div>
      )}
    </div>
  );
}

export default App;
