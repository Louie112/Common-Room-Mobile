import getGlobalStyles from '../../../app/globalStyles';
import React, { useState, useEffect, useRef } from 'react';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import MaterialIcons  from '@expo/vector-icons/MaterialIcons';
import {
  View,
  Text,
  useColorScheme,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  BackHandler,
  Image,
  Animated,
  Modal
} from 'react-native';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useNotification } from '../../../assets/NotificationContext';

import {
  getFirestore,
  collection,
  doc,
  onSnapshot,
  query,
  where,
  FieldPath,
  getDocs,
  setDoc,
  getDoc,
  updateDoc
} from '@react-native-firebase/firestore';
import { getAuth, onAuthStateChanged } from '@react-native-firebase/auth';

import { app } from '../../../configs/firebaseConfig';

const useUserData = (email) => {
  const [userData, setUserData] = useState({ givenName: false, photoURL: false });
  useEffect(() => {
    const db = getFirestore(app);
    const fetchUserData = async () => {
      try {
        const q = query(collection(db, 'users'), where('email', '==', email));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          const data = querySnapshot.docs[0].data();
          setUserData({
            givenName: data.givenName || null,
            photoURL: data.photoURL || null,
          });
        }
      } catch (error) {
        console.error('Error fetching user data for', email, error);
        setUserData({ givenName: email, photoURL: null });
      }
    };
    fetchUserData();
  }, [email]);
  
  return userData;
};

const Display = React.memo(({ email }) => {
  const colorScheme = useColorScheme();
  const { givenName } = useUserData(email);
  const globalStyles = getGlobalStyles(colorScheme);
  const { photoURL } = useUserData(email);
  return (
    <View>
      {photoURL === false || givenName === false ? (
        <View style={[styles.userHeader, {marginBottom: 10}]}>
        </View>
      ) : (
        <View style={styles.userHeader}>
          {photoURL ? (
            <Image source={{ uri: photoURL }} style={styles.friendImage} />
          ) : (
            <MaterialIcons name="account-circle" size={30} color={globalStyles.WhiteOrBlack.color} style={{marginRight: 0, position: 'absolute', top: 0}}/>
          )}
          <Text style={[styles.userInfoText, { position: 'absolute', left: 0, top: 5 }, { color: 'white', fontSize: 15, fontWeight: 500 }]}>{givenName}</Text>
        </View>
      )}
    </View>
  )
})

export default function Home() {
  const colorScheme = useColorScheme();
  const globalStyles = getGlobalStyles(colorScheme);
  const router = useRouter();
  const isFocused = useIsFocused();

  const [favouritedItems, setFavouritedItems] = useState([]);
  const [user, setUser] = useState(null);
  const [loadingFavourites, setLoadingFavourites] = useState(true);

  const [welcomeModalVisible, setWelcomeModalVisible] = useState(false);
  const [welcome2ModalVisible, setWelcome2ModalVisible] = useState(false);
  const [welcome4ModalVisible, setWelcome4ModalVisible] = useState(false);
  const [firstItemYet, setFirstItemYet] = useState(false);
  const [noFriends, setNoFriends] = useState(false);
  const [noFriendsVisible, setNoFriendsVisible] = useState(false);
  const [userData, setUserData] = useState(null);

  const { fcmPushToken } = useNotification();

  useFocusEffect(
    React.useCallback(() => {
      const backAction = () => {
        BackHandler.exitApp();
        return true;
      };

      const backHandler = BackHandler.addEventListener(
        'hardwareBackPress',
        backAction
      );

      return () => {
        backHandler.remove();
      };
    }, [])
  );

  useEffect(() => {
    if (user?.uid && fcmPushToken) {
      const db = getFirestore();
      setDoc(
        doc(db, "notifications", user.uid),
        {
          fcmPushToken,
          reserveNotification: [],
          releaseNotification: []
        },
        { merge: true }
      ).catch((error) => {
        console.error("Error updating push token in Firestore:", error);
      });
    }
  }, [user, fcmPushToken]);  

  const uid = user?.uid;

  useEffect(() => {
    // 2) Bail out until we actually have a UID and the screen is focused
    if (!uid || !isFocused) return;

    const db         = getFirestore();
    const userDocRef = doc(db, "users", uid);
    
    getDoc(userDocRef)
      .then((docSnap) => {
        if (!docSnap.exists) {
          console.warn("User document does not exist.");
          return;
        }
        const data = docSnap.data();
        setUserData(data);
        setWelcomeModalVisible(Boolean(data.welcome));
        setWelcome2ModalVisible(Boolean(data.welcome2));
        setWelcome4ModalVisible(Boolean(data.welcome4));
        setFirstItemYet(Boolean(data.firstItemYet));
        setNoFriends(Array.isArray(data.associated) && data.associated.length === 0);
        setNoFriendsVisible(Boolean(data.noFriendsVisible));
      })
      .catch((error) => {
        console.error("Error fetching user details:", error);
      });
    
  // 3) Only re-run when `uid` or `isFocused` changes
  }, [uid, isFocused]); 

  const fetchFavouritedItems = (userId) => {
    if (!userId) return;
    setLoadingFavourites(true);
  
    const db = getFirestore(app);
    let unsubscribeUser = null;
    let unsubscribeItems = null;
  
    try {
      const userDocRef = doc(db, 'users', userId);
      unsubscribeUser = onSnapshot(userDocRef, (docSnapshot) => {
        if (docSnapshot && docSnapshot.exists) {
          const data = docSnapshot.data();
          const favorites = data.favorites || [];
  
          if (favorites.length > 0) {
            const itemsRef = collection(db, 'items');
            const itemsQuery = query(
              itemsRef,
              where(FieldPath.documentId(), 'in', favorites)
            );
            unsubscribeItems = onSnapshot(itemsQuery, (querySnapshot) => {
              if (querySnapshot && !querySnapshot.empty) {
                const favoritedItemsDetails = querySnapshot.docs.map((doc) => ({
                  id: doc.id,
                  ...doc.data(),
                }));
                // Sort items according to the order in the "favorites" array.
                favoritedItemsDetails.sort(
                  (a, b) => favorites.indexOf(a.id) - favorites.indexOf(b.id)
                );
                setFavouritedItems(favoritedItemsDetails);
              } else {
                setFavouritedItems([]);
              }
              setLoadingFavourites(false);
            });
          } else {
            setFavouritedItems([]);
            setLoadingFavourites(false);
          }
        } else {
          setFavouritedItems([]);
          setLoadingFavourites(false);
        }
      });
  
      return () => {
        if (unsubscribeUser) unsubscribeUser();
        if (unsubscribeItems) unsubscribeItems();
      };
    } catch (error) {
      console.error('Error fetching favourited items: ', error);
      setLoadingFavourites(false);
    }
  };

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(getAuth(app), setUser);
    return () => unsubAuth();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      if (!user) {
        setFavouritedItems([]); 
        return;
      }
      const unsubFav = fetchFavouritedItems(user.uid, {
        onUpdate: setFavouritedItems,
        onError: (err) => console.error(err),
      });
      return () => unsubFav();
    }, [user])
  );

  const handleItemPress = (itemId, fromHome) => {
    router.push({
      pathname: '/(inspect)',
      params: { itemId, fromHome },
    });
  };

  const [expandedItems, setExpandedItems] = useState({});
  const animationValuesRef = useRef({});

  const getAnimationValue = (itemId) => {
    if (!animationValuesRef.current[itemId]) {
      animationValuesRef.current[itemId] = new Animated.Value(0);
    }
    return animationValuesRef.current[itemId];
  };

  const toggleDropdown = (itemId) => {
    // If the tapped dropdown is already expanded, collapse it.
    if (expandedItems[itemId]) {
      Animated.timing(getAnimationValue(itemId), {
        toValue: 0,
        duration: 300,
        useNativeDriver: false,
      }).start();
      setExpandedItems({});
    } else {
      // Collapse any other open dropdown first.
      const currentlyExpandedKey = Object.keys(expandedItems)[0];
      if (currentlyExpandedKey) {
        Animated.timing(getAnimationValue(currentlyExpandedKey), {
          toValue: 0,
          duration: 300,
          useNativeDriver: false,
        }).start();
      }
      // Then expand the newly selected dropdown.
      Animated.timing(getAnimationValue(itemId), {
        toValue: 1,
        duration: 300,
        useNativeDriver: false,
      }).start();
      setExpandedItems({ [itemId]: true });
    }
  };

  const handleWelcomeClose = async () => {
    setWelcomeModalVisible(false);
    const db = getFirestore();
    const userDocRef = doc(db, "users", user.uid);
    try {
      await updateDoc(userDocRef, { welcome: false });
    } catch (error) {
      console.error("Error updating the welcome field:", error);
    }
  }

  const handleWelcome2Close = async () => {
    setWelcome2ModalVisible(false);
    const db = getFirestore();
    const userDocRef = doc(db, "users", user.uid);
    try {
      await updateDoc(userDocRef, { welcome2: false });
    } catch (error) {
      console.error("Error updating the welcome field:", error);
    }
  }

  const handleWelcome4Close = async () => {
    setWelcome4ModalVisible(false);
    const db = getFirestore();
    const userDocRef = doc(db, "users", user.uid);
    try {
      await updateDoc(userDocRef, { welcome4: false });
    } catch (error) {
      console.error("Error updating the welcome field:", error);
    }
  }

  const handleNoFriendsVisibleClose = async () => {
    setNoFriendsVisible(false);
    const db = getFirestore();
    const userDocRef = doc(db, "users", user.uid);
    try {
      await updateDoc(userDocRef, { noFriendsVisible: false });
    } catch (error) {
      console.error("Error updating the welcome field:", error);
    }
  }

  const isFavouritesEmpty = favouritedItems.length === 0;

  return (
    <View style={{ flex: 1, backgroundColor: globalStyles.mainBackgroundColor.color }}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollViewContent,
          {
            backgroundColor: globalStyles.mainBackgroundColor.color,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.sectionTitle, { color: globalStyles.BlackOrwhite.color }]}>
          Favourites
        </Text>
        <View style={styles.listContainer}>
          {loadingFavourites ? (
            <View style={styles.loadingContainer}>
            </View>
          ) : favouritedItems.length === 0 ? (
            <Text style={[styles.emptyMessage, { marginTop: 60 }]}>
              No items favourited by you
            </Text>
          ) : (
            favouritedItems.map((item) => {
              const animation = getAnimationValue(item.id);
              const dropdownHeight = animation.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 110],
              });
              const dropdownOpacity = animation.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 1],
              });
              return (
                <View key={item.id} style={styles.listContainer}>
                  <TouchableOpacity
                    activeOpacity={1}
                    onPress={() => {
                      if (item.availability) {
                        // For available items, a tap immediately navigates.
                        handleItemPress(item.id, true);
                      } else {
                        // For unavailable items, tapping toggles expansion.
                        toggleDropdown(item.id);
                      }
                    }}
                    onLongPress={() => {
                      // For unavailable items, a long press also navigates.
                      if (!item.availability) {
                        handleItemPress(item.id, true);
                      }
                    }}
                    style={[
                      styles.item,
                      {
                        backgroundColor: item.availability
                          ? globalStyles.notOccupiedColor.color
                          : globalStyles.occupiedColor.color,
                        height: 100,
                      },
                    ]}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", marginTop: 15 }}>
                      {item.photoURL && (
                        <Image source={{ uri: item.photoURL }} style={styles.backgroundImage} />
                      )}
                      <View
                        style={{
                          flexDirection: "column",
                          alignItems: "flex-start",
                          padding: item.photoURL ? 10 : 12,
                          marginLeft: item.photoURL ? 5 : 20,
                          marginRight: item.photoURL ? 50 : 0,
                        }}
                      >
                        <Text
                          style={[
                            styles.itemText,
                            {
                              color: item.availability
                                ? globalStyles.itemTextColor.color
                                : "#e3e7f3",
                              marginBottom: 5,
                              fontWeight: "500",
                            },
                          ]}
                          numberOfLines={1}
                          ellipsizeMode="tail"
                        >
                          {item.name}
                        </Text>
                        {item.availability ? (
                          <Text style={[styles.statusText, { color: globalStyles.itemTextColor.color }]}>
                            Available
                          </Text>
                        ) : (
                          <Text style={[styles.statusText, { color: "#e3e7f3" }]}>
                            Unavailable
                          </Text>
                        )}
                      </View>
                      {item.availability ? (
                        <Icon name="chevron-right" size={30} color={globalStyles.BlackOrwhite.color} style={{ position: "absolute", right: 20, top: 20 }}/>
                      ) : (
                        expandedItems[item.id] ? <MaterialIcons name="horizontal-rule" size={24} color="#e3e7f3" style={{ position: "absolute", right: 25, top: 22 }}/> : <MaterialIcons name="add" size={24} color="#e3e7f3" style={{ position: "absolute", right: 25, top: 22 }}/> 
                      )}
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleItemPress(item.id, true)} activeOpacity={1}>
                    <Animated.View
                      style={[
                        styles.dropdown,
                        {
                          height: dropdownHeight,
                          opacity: dropdownOpacity,
                          backgroundColor: globalStyles.occupiedColor.color,
                        },
                      ]}
                    >
                      <View style={{ marginLeft: 15, marginTop: 15, marginBottom: 20 }}>
                        {item.inUseBy && item.inUseBy.length > 0 ? (
                          item.inUseBy.map((email) => (
                            <View
                              style={styles.userRow}
                              key={email}
                            >
                              <Display email={email} />
                              <Text style={[styles.userInfoText, { position: 'absolute', top: 30, color: "white", fontSize: 13 }]}>
                                {item.availabilityChangeTime || item.nextAvailabilityScheduledChangeTime ? (
                                  item.availabilityChangeTime ? (
                                    <Text>
                                      using until{" "}
                                      {item.availabilityChangeTime.toDate().toLocaleString("en-US", {
                                        month: "long",
                                        day: "numeric",
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      })}
                                    </Text>
                                  ) : (
                                    <Text>
                                      using until{" "}
                                      {item.nextAvailabilityScheduledChangeTime.toDate().toLocaleString("en-US", {
                                        month: "long",
                                        day: "numeric",
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      })}
                                    </Text>
                                  )
                                ) : (
                                  "using until manual release"
                                )}
                              </Text>
                              <View style={styles.userDetails}>
                                <Text style={[styles.subtleText, {position: 'absolute', top: 60}]}>Tap for more information</Text>
                              </View>
                            </View>
                          ))
                        ) : (
                          <Text style={[styles.expandedText, { color: "white" }]}>No availability info</Text>
                        )}
                      </View>
                      <View style={{ position: "absolute", right: 20, top: 40 }}>
                        <Icon name="chevron-right" size={30} color={"#e3e7f3"} />
                      </View>
                    </Animated.View>
                  </TouchableOpacity>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      {welcome2ModalVisible && !firstItemYet && (
        <View style={{position: 'absolute', left: '25%', width: 200, bottom: 0}}>
          <View style={{backgroundColor: globalStyles.mainColor.color, borderRadius: 15, paddingVertical: 30, paddingHorizontal: 30, elevation: 2}}>
            <Text style={{color: 'white', fontWeight: 500, fontSize: 17}}>Tap on 'My Stuff' to get started!</Text>
            <TouchableOpacity
              onPress={handleWelcome2Close}
              style={styles.closeButton}
            >
              <MaterialIcons
                name="close"
                size={20}
                color={'white'}
              />
            </TouchableOpacity>
          </View>
          <View style={[styles.triangle, {borderTopColor: globalStyles.mainColor.color, marginLeft: '18%'}]} />
        </View>
      )}
      {noFriendsVisible && noFriends && (
        <View style={{position: 'absolute', left: '20%', width: 200, bottom: 0, zIndex: 100}}>
          <View style={{backgroundColor: globalStyles.mainColor.color, borderRadius: 15, paddingVertical: 30, paddingHorizontal: 30, elevation: 2}}>
            <Text style={{color: 'white', fontWeight: 500, fontSize: 17}}>Add friends here!</Text>
            <TouchableOpacity
              onPress={handleNoFriendsVisibleClose}
              style={styles.closeButton}
            >
              <MaterialIcons
                name="close"
                size={20}
                color={'white'}
              />
            </TouchableOpacity>
          </View>
          <View style={[styles.triangle, {borderTopColor: globalStyles.mainColor.color, marginLeft: '73%'}]} />
        </View>
      )}
      {welcome4ModalVisible && firstItemYet && isFavouritesEmpty && !loadingFavourites && (
        <View style={{position: 'absolute', left: 20, width: '70%', top: 200}}>
          <View style={[styles.triangleUp, {borderBottomColor: globalStyles.mainColor.color, marginLeft: '25%'}]} />
          <View style={{backgroundColor: globalStyles.mainColor.color, borderRadius: 15, paddingVertical: 30, paddingHorizontal: 30, elevation: 2}}>
            <Text style={{color: 'white', fontWeight: 500, fontSize: 17}}>This is your home page</Text>
            <Text style={{color: 'white', fontSize: 15, marginTop: 10}}>Favourite items to quickly view them here</Text>
            <TouchableOpacity
              onPress={handleWelcome4Close}
              style={styles.closeButton}
            >
              <MaterialIcons
                name="close"
                size={20}
                color={'white'}
              />
            </TouchableOpacity>
          </View>
        </View>
      )}
      <Modal
        animationType="fade"
        transparent={true}
        visible={welcomeModalVisible}
        onRequestClose={handleWelcomeClose}
        statusBarTranslucent={true}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, {backgroundColor: '#1c0836'}]}>
            <Text style={{fontSize: 27, color: 'white', maxWidth: '70%', marginTop: 60, textAlign: 'center', fontWeight: 500}}>Welcome to</Text>
            <Text style={{fontSize: 27, color: 'white', maxWidth: '70%', marginTop: 0, textAlign: 'center', fontWeight: 500}}>Common Room!</Text>
            <Text style={{color: 'white', marginTop: 30, maxWidth: '80%', textAlign: 'center'}}>This app is designed to help you share things with your family and friends.</Text>
            <Text style={{color: 'white', marginTop: 30, maxWidth: '80%', textAlign: 'center'}}>An easy way to communicate what you would like to use and when!</Text>
            <Text style={{color: 'white', marginTop: 10, maxWidth: '80%', textAlign: 'center'}}>Simply schedule the days, hours, or minutes you need something.</Text>
            <Text style={{color: 'white', marginTop: 30, marginBottom: 40, maxWidth: '80%', textAlign: 'center'}}>Happy scheduling!</Text>
            <Image
              source={require('../../../assets/images/newicon.png')}
              style={styles.image}
              resizeMode="contain"
            />
            <TouchableOpacity
              style={[
                styles.button,
                { backgroundColor: 'white' },
              ]}
              onPress={handleWelcomeClose} 
            >
              <Text style={{ color: '#1c0836', fontWeight: 500 }}>Continue</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  triangleUp: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderBottomWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    marginBottom: -1,
  },
  closeButton: {
    position: 'absolute',
    top: 10,
    right: 10,
  },
  triangle: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderTopWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    marginTop: -1,
  },
  button: {
    width: '80%',
    borderRadius: 50,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
    marginTop: 40,
  },
  image: {
    width: 200,
    height: 200,
    borderRadius: 60,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    width: '100%',
    backgroundColor: 'white',
    alignItems:'center',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20
  },
  dropdown: {
    overflow: 'hidden',
    marginBottom: 7,
    marginTop: 2,
    paddingHorizontal: 0,
    borderRadius: 30,
  },
  dropdownText: {
    paddingVertical: 10,
    color: '#2c3e50',
  },
  textBubble:{
    backgroundColor: '#e0e0e0',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
    alignSelf: 'flex-start',
  },
  backgroundImage: {
    width: 70,
    height: 70,
    borderRadius: 15,
    marginLeft: 15,
  },
  subtleText: {
    fontSize: 10,
    color: '#f0f0f0',
  },
  expandedContent: {
    flexDirection: 'column',
  },
  userRow: {
    flexDirection: 'column',
    marginBottom: 0,
  },
  userHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userDetails: {
    marginLeft: 40,
  },
  userInfoText: {
    fontSize: 15,
    marginLeft: 40,
  },
  scrollViewContent: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 15,
    marginBottom: 20,
    textAlign: 'left',
    marginLeft: 10,
    fontWeight: '500',
  },
  listContainer: {
    flexDirection: 'column',
    width: '100%',
  },
  item: {
    width: '100%',
    marginBottom: 0,
    borderRadius: 30,
  },
  itemText: {
    fontSize: 15,
    marginRight: 50,
    maxWidth: '70%'
  },
  expandedText: {
    fontSize: 13,
  },
  statusText: {
    fontSize: 13,
  },
  friendImage: {
    width: 30,
    height: 30,
    borderRadius: 20,
    position: 'absolute',
    left: 0,
    top: 0
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyMessage: {
    fontSize: 13,
    color: '#7d7d7d',
    marginTop: 50,
    marginBottom: 50,
    textAlign: 'center',
    width: '100%',
  },
});
